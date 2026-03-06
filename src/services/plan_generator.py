"""Plan generation service: assembles context → calls LLM → validates → stores."""

import json
import logging
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_user_id
from src.llm.client import call_llm_json
from src.llm.prompts import (
    GENERATE_DAY_PLAN_SYSTEM,
    VALIDATE_PLAN_SYSTEM,
    build_generate_day_prompt,
    build_validate_prompt,
)
from src.models.exercises import Exercise, ExerciseStats
from src.models.plans import Plan, PlanDay
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState, Setting, WeekTemplate
from src.services.progression_hint_service import build_progression_hints
from src.services.recommendation_service import suggest_day

logger = logging.getLogger(__name__)


async def get_day_template(session: AsyncSession, day_index: int) -> WeekTemplate | None:
    """Get the week template for a given day index."""
    result = await session.execute(
        select(WeekTemplate).where(WeekTemplate.day_index == day_index)
    )
    return result.scalar_one_or_none()


async def get_exercises_for_day(
    session: AsyncSession,
    day_rules: dict,
) -> list[dict]:
    """Get filtered exercise subset relevant to a training day."""
    required = set(day_rules.get("required_patterns", []))
    optional = set(day_rules.get("optional_patterns", []))
    all_patterns = required | optional
    primary_muscles = set(day_rules.get("primary_muscles", []))

    filters = [Exercise.movement_pattern.in_(all_patterns) | Exercise.is_anchor.is_(True)]
    if primary_muscles:
        filters.append(Exercise.primary_muscle.in_(primary_muscles))

    result = await session.execute(
        select(Exercise, ExerciseStats)
        .outerjoin(ExerciseStats, Exercise.id == ExerciseStats.exercise_id)
        .where(or_(*filters))
    )

    exercises = []
    for exercise, stats in result.all():
        exercises.append({
            "id": exercise.id,
            "name": exercise.name_canonical,
            "primary_muscle": exercise.primary_muscle,
            "type": exercise.type,
            "movement_pattern": exercise.movement_pattern,
            "is_anchor": exercise.is_anchor,
            "is_staple": exercise.is_staple,
            "avg_weight": stats.avg_weight if stats else 0,
            "avg_reps": stats.avg_reps if stats else 0,
            "frequency_score": stats.frequency_score if stats else "low",
        })

    return exercises


async def get_anchor_targets_for_day(
    session: AsyncSession,
    day_rules: dict,
) -> list[dict]:
    """Get anchor targets for the day's anchor exercises."""
    user_id = get_current_user_id()
    anchor_names = day_rules.get("anchors", [])
    if not anchor_names:
        return []

    result = await session.execute(
        select(AnchorTarget, Exercise.name_canonical)
        .join(Exercise, AnchorTarget.exercise_id == Exercise.id)
        .where(AnchorTarget.user_id == user_id)
        .where(Exercise.name_canonical.in_(anchor_names))
    )

    targets = []
    for target, name in result.all():
        targets.append({
            "exercise": name,
            "target_weight_lbs": target.target_weight,
            "target_reps_min": target.target_reps_min,
            "target_reps_max": target.target_reps_max,
            "status": target.status,
            "streak": target.streak,
        })

    return targets


async def get_constraints(session: AsyncSession) -> dict:
    """Load program constraints from settings."""
    user_id = get_current_user_id()
    constraints = {}
    result = await session.execute(
        select(Setting).where(
            Setting.user_id == user_id,
            Setting.key.startswith("constraint_"),
        )
    )
    for setting in result.scalars().all():
        key = setting.key.replace("constraint_", "")
        constraints[key] = json.loads(setting.value)
    return constraints


async def generate_day_plan(
    session: AsyncSession,
    day_index: int | None = None,
    day_name: str | None = None,
) -> dict | None:
    """
    Generate a training plan for a specific day.

    1. Load template day
    2. Get anchor targets
    3. Filter exercise library
    4. Build prompt context
    5. Call LLM → parse JSON → validate
    6. Store in plan_days
    """
    # Get current state if no explicit day
    user_id = get_current_user_id()
    if day_index is None and day_name is None:
        suggestion = await suggest_day(session)
        if suggestion.get("day_name"):
            day_name = suggestion["day_name"]
            fatigue = 0.0
        else:
            state_result = await session.execute(
                select(AthleteState).where(AthleteState.user_id == user_id)
            )
            state = state_result.scalar_one_or_none()
            day_index = state.next_day_index if state else 1
            fatigue = state.fatigue_score if state else 0.0
    else:
        fatigue = 0.0

    # Load template
    if day_name:
        template_result = await session.execute(
            select(WeekTemplate).where(WeekTemplate.name == day_name)
        )
        template = template_result.scalar_one_or_none()
    else:
        if day_index is None:
            logger.error("No template index available")
            return None
        template = await get_day_template(session, day_index)
    if template is None:
        if day_name:
            logger.error("No template found for day name %s", day_name)
        else:
            logger.error("No template found for day index %d", day_index)
        return None

    day_rules = json.loads(template.rules_json)

    # Get context
    anchor_targets = await get_anchor_targets_for_day(session, day_rules)
    exercise_subset = await get_exercises_for_day(session, day_rules)
    constraints = await get_constraints(session)
    progression_hints = await build_progression_hints(
        session,
        [e["id"] for e in exercise_subset if e.get("id")],
    )
    exercise_subset = [
        {k: v for k, v in ex.items() if k != "id"}
        for ex in exercise_subset
    ]

    # Flatten constraints for prompt
    flat_constraints = {}
    for section_key, section_val in constraints.items():
        if isinstance(section_val, dict):
            flat_constraints.update(section_val)
        else:
            flat_constraints[section_key] = section_val

    # Build prompt
    user_prompt = build_generate_day_prompt(
        day_name=template.name,
        day_focus=template.focus,
        day_rules=day_rules,
        anchor_targets=anchor_targets,
        exercise_subset=exercise_subset,
        constraints=flat_constraints,
        fatigue_score=fatigue,
        progression_hints=progression_hints,
    )

    # Call LLM
    plan_json = await call_llm_json(GENERATE_DAY_PLAN_SYSTEM, user_prompt)

    if plan_json is None:
        logger.warning("LLM returned no plan — generating fallback")
        plan_json = _generate_fallback_plan(template.name, anchor_targets, day_rules)

    # Validate
    validated = await _validate_plan(session, plan_json, flat_constraints)
    if validated and not validated.get("is_valid", True):
        logger.warning("Plan validation failed: %s", validated.get("violations"))
        if validated.get("corrected_plan"):
            plan_json = validated["corrected_plan"]

    # Store
    plan = Plan(
        user_id=user_id,
        start_date=date.today(),
        end_date=date.today(),
        goal=f"{template.name} session",
        days_per_week=6,
    )
    session.add(plan)
    await session.flush()

    plan_day = PlanDay(
        plan_id=plan.id,
        date=date.today(),
        template_day_name=template.name,
        content_json=json.dumps(plan_json),
        validation_json=json.dumps(validated) if validated else None,
    )
    session.add(plan_day)
    await session.commit()

    logger.info("Generated plan for %s (day %d)", template.name, day_index)
    return plan_json


def _generate_fallback_plan(
    day_name: str,
    anchor_targets: list[dict],
    day_rules: dict,
) -> dict:
    """Generate a basic plan without LLM, using only anchor targets."""
    exercises = []

    for target in anchor_targets:
        exercises.append({
            "name": target["exercise"],
            "is_anchor": True,
            "sets": [
                {
                    "set_type": "warmup",
                    "weight_lbs": round(target["target_weight_lbs"] * 0.5),
                    "target_reps": 10,
                    "rir_target": 5,
                    "rest_seconds": 60,
                },
                {
                    "set_type": "warmup",
                    "weight_lbs": round(target["target_weight_lbs"] * 0.75),
                    "target_reps": 6,
                    "rir_target": 3,
                    "rest_seconds": 90,
                },
            ]
            + [
                {
                    "set_type": "normal",
                    "weight_lbs": target["target_weight_lbs"],
                    "target_reps": target["target_reps_max"],
                    "rir_target": 1,
                    "rest_seconds": 180,
                }
                for _ in range(3)
            ],
            "notes": f"Target: {target['target_weight_lbs']}lb x {target['target_reps_min']}-{target['target_reps_max']}",
        })

    return {
        "day_name": day_name,
        "estimated_duration_min": 60,
        "exercises": exercises,
        "total_sets": sum(len(e["sets"]) for e in exercises),
        "estimated_volume_lbs": 0,
        "note": "Fallback plan — LLM unavailable. Only anchor exercises included.",
    }


async def _validate_plan(
    session: AsyncSession,
    plan_json: dict,
    constraints: dict,
) -> dict | None:
    """Validate a plan against constraints using LLM. Returns validation result."""
    user_prompt = build_validate_prompt(plan_json, constraints)
    return await call_llm_json(VALIDATE_PLAN_SYSTEM, user_prompt)
