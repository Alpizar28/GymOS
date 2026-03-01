"""Deterministic progression engine. NO LLM calls — pure business rules."""

import json
import logging
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise
from src.models.progression import AnchorTarget
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet

logger = logging.getLogger(__name__)


class ProgressionAction(str, Enum):
    """Outcome of evaluating an anchor's last performance."""

    INCREASE_WEIGHT = "increase_weight"
    INCREASE_REPS = "increase_reps"
    CONSOLIDATE = "consolidate"
    DELOAD = "deload"
    NO_DATA = "no_data"


@dataclass(frozen=True)
class ProgressionResult:
    """Result of evaluating an anchor exercise."""

    exercise_name: str
    action: ProgressionAction
    old_weight: float
    new_weight: float
    old_reps_range: tuple[int, int]
    new_reps_range: tuple[int, int]
    reason: str


def evaluate_anchor(
    target: AnchorTarget,
    exercise_name: str,
    top_set_reps: int | None,
    top_set_rir: int | None,
    recent_rep_counts: list[int],
) -> ProgressionResult:
    """
    Evaluate an anchor exercise and determine next target.

    Rules (from spec):
    - top_set RIR >= 2  → weight += increment (default 5 lb)
    - top_set RIR ≈ 1   → same weight, target reps += 1
    - top_set RIR == 0   → consolidate (same weight/reps)
    - 2 consecutive sessions with declining reps → deload 5-10%
    """
    rules = json.loads(target.rule_profile)
    increment = rules.get("increment_lbs", 5)
    deload_pct = rules.get("deload_pct", 0.10)
    consolidation_threshold = rules.get("consolidation_sessions", 2)

    old_weight = target.target_weight
    old_reps = (target.target_reps_min, target.target_reps_max)

    # No data case
    if top_set_reps is None or top_set_rir is None:
        return ProgressionResult(
            exercise_name=exercise_name,
            action=ProgressionAction.NO_DATA,
            old_weight=old_weight,
            new_weight=old_weight,
            old_reps_range=old_reps,
            new_reps_range=old_reps,
            reason="No set data available",
        )

    # Check for declining reps (deload trigger)
    if _should_deload(recent_rep_counts, consolidation_threshold):
        new_weight = round(old_weight * (1 - deload_pct), 1)
        # Round down to nearest 5
        new_weight = max(5, (new_weight // 5) * 5)
        return ProgressionResult(
            exercise_name=exercise_name,
            action=ProgressionAction.DELOAD,
            old_weight=old_weight,
            new_weight=new_weight,
            old_reps_range=old_reps,
            new_reps_range=old_reps,  # reset reps to original range
            reason=f"Reps declined over {consolidation_threshold} sessions → deload to {new_weight} lbs",
        )

    # RIR >= 2: exercise felt easy → increase weight
    if top_set_rir >= 2:
        new_weight = old_weight + increment
        return ProgressionResult(
            exercise_name=exercise_name,
            action=ProgressionAction.INCREASE_WEIGHT,
            old_weight=old_weight,
            new_weight=new_weight,
            old_reps_range=old_reps,
            new_reps_range=old_reps,
            reason=f"RIR {top_set_rir} ≥ 2 → +{increment} lbs",
        )

    # RIR == 1: close to failure → try to add a rep
    if top_set_rir == 1:
        new_reps_max = old_reps[1] + 1
        return ProgressionResult(
            exercise_name=exercise_name,
            action=ProgressionAction.INCREASE_REPS,
            old_weight=old_weight,
            new_weight=old_weight,
            old_reps_range=old_reps,
            new_reps_range=(old_reps[0], new_reps_max),
            reason=f"RIR 1 → same weight, target reps up to {new_reps_max}",
        )

    # RIR == 0: at failure → consolidate
    return ProgressionResult(
        exercise_name=exercise_name,
        action=ProgressionAction.CONSOLIDATE,
        old_weight=old_weight,
        new_weight=old_weight,
        old_reps_range=old_reps,
        new_reps_range=old_reps,
        reason="RIR 0 → consolidate at current weight/reps",
    )


def _should_deload(recent_rep_counts: list[int], threshold: int) -> bool:
    """Check if reps have declined over `threshold` consecutive sessions."""
    if len(recent_rep_counts) < threshold:
        return False
    # Check last `threshold` sessions for strictly declining reps
    last_n = recent_rep_counts[-threshold:]
    return all(last_n[i] > last_n[i + 1] for i in range(len(last_n) - 1))


async def get_recent_sets_for_exercise(
    session: AsyncSession,
    exercise_id: int,
    limit: int = 5,
) -> list[dict]:
    """Get the most recent workout sets for an exercise, across sessions."""
    result = await session.execute(
        select(WorkoutSet, Workout.date)
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .where(WorkoutExercise.exercise_id == exercise_id)
        .where(WorkoutSet.set_type == "normal")
        .order_by(desc(Workout.date), desc(WorkoutSet.id))
        .limit(limit * 5)  # get enough sets across sessions
    )
    rows = result.all()

    # Group by session date, take top set per session
    sessions: dict[str, list] = {}
    for workout_set, workout_date in rows:
        date_key = str(workout_date)
        if date_key not in sessions:
            sessions[date_key] = []
        sessions[date_key].append({
            "reps": workout_set.reps,
            "weight": workout_set.weight,
            "rir": workout_set.rir,
        })

    return [
        {"date": date_key, "sets": sets}
        for date_key, sets in sorted(sessions.items(), reverse=True)[:limit]
    ]


async def update_anchor_after_workout(
    session: AsyncSession,
    workout_id: int,
) -> list[ProgressionResult]:
    """
    After a workout is logged, evaluate all anchor exercises
    that were performed and update their targets.
    """
    # Get all exercises in this workout
    result = await session.execute(
        select(WorkoutExercise)
        .where(WorkoutExercise.workout_id == workout_id)
    )
    workout_exercises = result.scalars().all()

    results: list[ProgressionResult] = []

    for we in workout_exercises:
        # Check if this exercise has an anchor target
        target_result = await session.execute(
            select(AnchorTarget).where(AnchorTarget.exercise_id == we.exercise_id)
        )
        target = target_result.scalar_one_or_none()
        if target is None:
            continue

        # Get exercise name
        ex_result = await session.execute(
            select(Exercise).where(Exercise.id == we.exercise_id)
        )
        exercise = ex_result.scalar_one()

        # Get sets for this exercise in this workout
        sets_result = await session.execute(
            select(WorkoutSet)
            .where(WorkoutSet.workout_exercise_id == we.id)
            .where(WorkoutSet.set_type == "normal")
            .order_by(desc(WorkoutSet.weight))
        )
        sets = sets_result.scalars().all()

        if not sets:
            continue

        # Top set = heaviest normal set
        top_set = sets[0]

        # Get recent rep counts (top set reps from last N sessions)
        recent_sessions = await get_recent_sets_for_exercise(
            session, we.exercise_id, limit=5
        )
        recent_rep_counts = []
        for sess in recent_sessions:
            if sess["sets"]:
                # top set reps per session (heaviest set)
                heaviest = max(sess["sets"], key=lambda s: s["weight"] or 0)
                if heaviest["reps"] is not None:
                    recent_rep_counts.append(heaviest["reps"])

        # Evaluate progression
        progression = evaluate_anchor(
            target=target,
            exercise_name=exercise.name_canonical,
            top_set_reps=top_set.reps,
            top_set_rir=top_set.rir,
            recent_rep_counts=recent_rep_counts,
        )
        results.append(progression)

        # Apply progression to target
        target.target_weight = progression.new_weight
        target.target_reps_min = progression.new_reps_range[0]
        target.target_reps_max = progression.new_reps_range[1]
        target.last_rir = top_set.rir

        if progression.action == ProgressionAction.INCREASE_WEIGHT:
            target.streak += 1
            target.status = "active"
        elif progression.action == ProgressionAction.DELOAD:
            target.streak = 0
            target.status = "deload"
        elif progression.action == ProgressionAction.CONSOLIDATE:
            target.status = "consolidate"
        else:
            target.status = "active"

        session.add(target)
        logger.info(
            "Progression for %s: %s (%.1f → %.1f lbs)",
            exercise.name_canonical,
            progression.action.value,
            progression.old_weight,
            progression.new_weight,
        )

    await session.flush()
    return results
