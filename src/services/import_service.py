"""Import JSON artifacts into the database. Runs once on initial setup."""

import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise, ExerciseStats
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState, Setting, WeekTemplate

logger = logging.getLogger(__name__)

# Default 6-day split as per spec
WEEK_TEMPLATE = [
    {
        "day_index": 1,
        "name": "Push_Heavy",
        "focus": "Chest heavy compound + shoulder/triceps touch",
        "rules_json": json.dumps({
            "anchors": ["Incline Bench Press", "Bench Press", "Smith Machine Incline Bench Press"],
            "required_patterns": ["horizontal_push"],
            "optional_patterns": ["vertical_push", "lateral_raise"],
            "max_exercises": 6,
            "max_sets": 20,
        }),
    },
    {
        "day_index": 2,
        "name": "Pull_Heavy",
        "focus": "Back heavy compound + biceps touch",
        "rules_json": json.dumps({
            "anchors": ["Lat Pulldown", "T Bar Row", "Seated Cable Row"],
            "required_patterns": ["vertical_pull", "horizontal_pull"],
            "optional_patterns": [],
            "max_exercises": 6,
            "max_sets": 20,
        }),
    },
    {
        "day_index": 3,
        "name": "Quads_Heavy",
        "focus": "Squat anchor + quad accessories",
        "rules_json": json.dumps({
            "anchors": ["Squat", "Sled Leg Press", "Hack Squat"],
            "required_patterns": ["squat"],
            "optional_patterns": ["hinge"],
            "max_exercises": 5,
            "max_sets": 18,
        }),
    },
    {
        "day_index": 4,
        "name": "Upper_Complement",
        "focus": "Chest + back volume/quality work",
        "rules_json": json.dumps({
            "anchors": ["Chest Press", "Machine Row"],
            "required_patterns": ["horizontal_push", "horizontal_pull"],
            "optional_patterns": ["vertical_pull"],
            "max_exercises": 7,
            "max_sets": 22,
        }),
    },
    {
        "day_index": 5,
        "name": "Arms_Shoulders",
        "focus": "Metabolic/failure emphasis, shoulder priority",
        "rules_json": json.dumps({
            "anchors": ["Machine Shoulder Press"],
            "required_patterns": ["lateral_raise", "vertical_push"],
            "optional_patterns": ["vertical_pull"],
            "max_exercises": 7,
            "max_sets": 24,
            "allow_drop_sets": True,
        }),
    },
    {
        "day_index": 6,
        "name": "Posterior_Heavy",
        "focus": "Hamstrings + glutes, hinge pattern priority",
        "rules_json": json.dumps({
            "anchors": ["Hip Thrust", "Dumbbell Romanian Deadlift"],
            "required_patterns": ["hinge"],
            "optional_patterns": ["squat", "unilateral"],
            "max_exercises": 5,
            "max_sets": 18,
        }),
    },
    {
        "day_index": 7,
        "name": "Pecho_Hombro_Tricep",
        "focus": "Pecho, hombro y tricep con prioridad en press y deltoides",
        "rules_json": json.dumps({
            "anchors": ["Bench Press", "Incline Bench Press", "Machine Shoulder Press"],
            "required_patterns": ["horizontal_push", "vertical_push"],
            "optional_patterns": ["lateral_raise"],
            "primary_muscles": ["chest", "front_delts", "side_delts", "triceps"],
            "max_exercises": 7,
            "max_sets": 24,
        }),
    },
    {
        "day_index": 8,
        "name": "Espalda_Biceps",
        "focus": "Espalda y biceps con tirones verticales y horizontales",
        "rules_json": json.dumps({
            "anchors": ["Lat Pulldown", "Seated Cable Row", "T Bar Row"],
            "required_patterns": ["vertical_pull", "horizontal_pull"],
            "optional_patterns": [],
            "primary_muscles": ["lats", "upper_back", "biceps", "rear_delts"],
            "max_exercises": 7,
            "max_sets": 24,
        }),
    },
    {
        "day_index": 9,
        "name": "Cuadriceps",
        "focus": "Cuadriceps dominante con sentadillas y extensiones",
        "rules_json": json.dumps({
            "anchors": ["Squat", "Sled Leg Press", "Hack Squat"],
            "required_patterns": ["squat"],
            "optional_patterns": ["unilateral"],
            "primary_muscles": ["quads"],
            "max_exercises": 6,
            "max_sets": 22,
        }),
    },
    {
        "day_index": 10,
        "name": "Femorales_Nalga",
        "focus": "Femorales y gluteos con hinge y curl",
        "rules_json": json.dumps({
            "anchors": ["Romanian Deadlift", "Hip Thrust"],
            "required_patterns": ["hinge"],
            "optional_patterns": ["unilateral"],
            "primary_muscles": ["hamstrings", "glutes"],
            "max_exercises": 6,
            "max_sets": 22,
        }),
    },
    {
        "day_index": 11,
        "name": "Pierna",
        "focus": "Pierna completa (cuadriceps + femorales)",
        "rules_json": json.dumps({
            "anchors": ["Squat", "Sled Leg Press", "Romanian Deadlift"],
            "required_patterns": ["squat", "hinge"],
            "optional_patterns": ["unilateral"],
            "primary_muscles": ["quads", "hamstrings", "glutes", "calves"],
            "max_exercises": 7,
            "max_sets": 26,
        }),
    },
    {
        "day_index": 12,
        "name": "Brazo",
        "focus": "Biceps, triceps y hombro con enfasis en deltoides",
        "rules_json": json.dumps({
            "anchors": ["Machine Shoulder Press"],
            "required_patterns": ["lateral_raise", "vertical_push"],
            "optional_patterns": ["horizontal_pull", "vertical_pull", "horizontal_push"],
            "primary_muscles": ["biceps", "triceps", "front_delts", "side_delts", "rear_delts"],
            "max_exercises": 7,
            "max_sets": 26,
            "allow_drop_sets": True,
        }),
    },
    {
        "day_index": 13,
        "name": "Pecho_Espalda",
        "focus": "Pecho y espalda balanceado con empujes y jalones",
        "rules_json": json.dumps({
            "anchors": ["Bench Press", "Seated Cable Row", "Lat Pulldown"],
            "required_patterns": ["horizontal_push", "horizontal_pull"],
            "optional_patterns": ["vertical_pull"],
            "primary_muscles": ["chest", "lats", "upper_back"],
            "max_exercises": 7,
            "max_sets": 24,
        }),
    },
]

# Default rule profiles by exercise type
DEFAULT_COMPOUND_RULES = json.dumps({
    "increment_lbs": 5,
    "deload_pct": 0.10,
    "consolidation_sessions": 2,
    "rep_range": [5, 8],
})

DEFAULT_ISOLATION_ANCHOR_RULES = json.dumps({
    "increment_lbs": 5,
    "deload_pct": 0.10,
    "consolidation_sessions": 2,
    "rep_range": [8, 12],
})


async def import_athlete_profile(session: AsyncSession, path: Path) -> int:
    """Import ATHLETE_PROFILE.json → settings table. Returns number of keys inserted."""
    data = json.loads(path.read_text())
    count = 0
    for key, value in data.items():
        setting = Setting(key=f"athlete_{key}", value=json.dumps(value))
        session.add(setting)
        count += 1
    await session.flush()
    logger.info("Imported %d athlete profile keys", count)
    return count


async def import_exercise_library(session: AsyncSession, path: Path) -> int:
    """Import EXERCISE_LIBRARY.json → exercises + exercise_stats. Returns exercise count."""
    data: list[dict] = json.loads(path.read_text())
    count = 0

    for entry in data:
        notes = entry.get("notes", "")
        is_anchor = "strength_anchor" in notes
        is_staple = "high_frequency_staple" in notes

        exercise = Exercise(
            name_canonical=entry["name"],
            aliases_json=json.dumps([]),  # aliases start empty, user adds via /alias
            primary_muscle=entry.get("primary_muscle", "unknown"),
            secondary_muscles_json=json.dumps(entry.get("secondary_muscles", [])),
            type=entry.get("type", "unknown"),
            movement_pattern=entry.get("movement_pattern", "unknown"),
            is_anchor=is_anchor,
            is_staple=is_staple,
        )
        session.add(exercise)
        await session.flush()  # get exercise.id

        stats = ExerciseStats(
            exercise_id=exercise.id,
            avg_reps=entry.get("avg_reps", 0.0),
            avg_weight=entry.get("avg_weight_lbs", 0.0),
            max_weight=entry.get("max_weight_detected_lbs", 0.0),
            frequency_score=entry.get("frequency_score", "low"),
            total_sets=entry.get("total_sets", 0),
            volume_contribution_pct=entry.get("volume_contribution_pct", 0.0),
        )
        session.add(stats)
        count += 1

    await session.flush()
    logger.info("Imported %d exercises with stats", count)
    return count


async def import_program_constraints(session: AsyncSession, path: Path) -> int:
    """Import PROGRAM_CONSTRAINTS.json → settings table. Returns number of keys inserted."""
    data = json.loads(path.read_text())
    count = 0
    for key, value in data.items():
        setting = Setting(key=f"constraint_{key}", value=json.dumps(value))
        session.add(setting)
        count += 1
    await session.flush()
    logger.info("Imported %d constraint keys", count)
    return count


async def seed_week_template(session: AsyncSession) -> int:
    """Insert training templates. Returns number of days inserted."""
    for day in WEEK_TEMPLATE:
        template = WeekTemplate(**day)
        session.add(template)
    await session.flush()
    logger.info("Seeded %d week template days", len(WEEK_TEMPLATE))
    return len(WEEK_TEMPLATE)


async def ensure_week_template(session: AsyncSession) -> int:
    """Insert missing templates by name. Returns number of days inserted."""
    result = await session.execute(select(WeekTemplate.name))
    existing = {name for (name,) in result.all()}
    inserted = 0

    for day in WEEK_TEMPLATE:
        if day["name"] in existing:
            continue
        session.add(WeekTemplate(**day))
        inserted += 1

    if inserted:
        await session.flush()
        logger.info("Inserted %d missing week templates", inserted)
    return inserted


async def seed_athlete_state(session: AsyncSession) -> None:
    """Create the singleton athlete_state row."""
    state = AthleteState(id=1, next_day_index=1, fatigue_score=0.0)
    session.add(state)
    await session.flush()
    logger.info("Seeded athlete state")


async def seed_anchor_targets(session: AsyncSession) -> int:
    """Create default AnchorTarget rows for every is_anchor exercise."""
    result = await session.execute(select(Exercise).where(Exercise.is_anchor.is_(True)))
    anchors = result.scalars().all()
    count = 0

    for exercise in anchors:
        # Determine rep range from stats
        stats_result = await session.execute(
            select(ExerciseStats).where(ExerciseStats.exercise_id == exercise.id)
        )
        stats = stats_result.scalar_one_or_none()

        avg_reps = stats.avg_reps if stats else 8.0
        is_compound = exercise.type == "compound"

        # Compounds: heavy rep range (5-8), isolations: moderate (8-12)
        if is_compound and avg_reps < 8:
            reps_min, reps_max = 5, 8
            rules = DEFAULT_COMPOUND_RULES
        else:
            reps_min, reps_max = 8, 12
            rules = DEFAULT_ISOLATION_ANCHOR_RULES

        target_weight = stats.avg_weight if stats else 100.0

        target = AnchorTarget(
            exercise_id=exercise.id,
            target_weight=target_weight,
            target_reps_min=reps_min,
            target_reps_max=reps_max,
            rule_profile=rules,
            streak=0,
            status="active",
        )
        session.add(target)
        count += 1

    await session.flush()
    logger.info("Seeded %d anchor targets", count)
    return count


async def run_full_import(
    session: AsyncSession,
    athlete_profile_path: Path,
    exercise_library_path: Path,
    program_constraints_path: Path,
) -> dict[str, int]:
    """Run all import steps in order. Returns counts dict."""
    results: dict[str, int] = {}
    results["athlete_profile_keys"] = await import_athlete_profile(session, athlete_profile_path)
    results["exercises"] = await import_exercise_library(session, exercise_library_path)
    results["constraint_keys"] = await import_program_constraints(
        session, program_constraints_path
    )
    results["week_template_days"] = await seed_week_template(session)
    await seed_athlete_state(session)
    results["anchor_targets"] = await seed_anchor_targets(session)
    await session.commit()
    logger.info("Full import complete: %s", results)
    return results
