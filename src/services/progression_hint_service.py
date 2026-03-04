"""Generate progression hints from recent sessions."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet


def _increment_for_type(exercise_type: str) -> float:
    return 5.0 if exercise_type == "compound" else 2.5


def _summarize_history(history: list[dict], exercise_type: str) -> dict:
    if not history:
        return {"action": "maintain", "reason": "no_history"}

    last = history[0]
    prev = history[1] if len(history) > 1 else None
    prev2 = history[2] if len(history) > 2 else None

    rir = last.get("rir")
    increment = _increment_for_type(exercise_type)

    if rir is not None:
        if rir >= 2:
            return {"action": "increase_weight", "delta_lbs": increment, "reason": "rir>=2"}
        if rir == 1:
            return {"action": "increase_reps", "delta_reps": 1, "reason": "rir==1"}
        if rir == 0:
            return {"action": "maintain", "reason": "rir==0"}

    if prev and prev2:
        if last.get("reps") is not None and prev.get("reps") is not None and prev2.get("reps") is not None:
            if last["reps"] < prev["reps"] and prev["reps"] < prev2["reps"]:
                return {"action": "deload", "reason": "reps_declining"}

    if prev and last.get("reps") is not None and prev.get("reps") is not None:
        if last["reps"] <= prev["reps"] and last.get("weight") == prev.get("weight"):
            return {"action": "increase_reps", "delta_reps": 1, "reason": "flat_reps"}

    if prev and prev2 and exercise_type != "compound":
        if (
            last.get("reps") == prev.get("reps") == prev2.get("reps")
            and last.get("weight") == prev.get("weight") == prev2.get("weight")
        ):
            return {"action": "add_set", "reason": "accessory_stagnation"}

    return {"action": "maintain", "reason": "stable"}


async def build_progression_hints(
    session: AsyncSession,
    exercise_ids: list[int],
) -> list[dict]:
    if not exercise_ids:
        return []

    ex_result = await session.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
    exercises = {ex.id: ex for ex in ex_result.scalars().all()}

    result = await session.execute(
        select(
            Exercise.id,
            Exercise.name_canonical,
            Exercise.type,
            Workout.id.label("workout_id"),
            Workout.date,
            WorkoutSet.set_type,
            WorkoutSet.actual_weight,
            WorkoutSet.actual_reps,
            WorkoutSet.actual_rir,
            WorkoutSet.weight,
            WorkoutSet.reps,
            WorkoutSet.rir,
        )
        .join(WorkoutExercise, WorkoutExercise.exercise_id == Exercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .join(WorkoutSet, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .where(Exercise.id.in_(exercise_ids))
        .where(WorkoutSet.set_type == "normal")
        .order_by(
            Exercise.id,
            desc(Workout.date),
            desc(Workout.id),
            desc(func.coalesce(WorkoutSet.actual_weight, WorkoutSet.weight)),
        )
    )

    sessions: dict[int, list[dict]] = defaultdict(list)
    seen_workouts: dict[int, set[int]] = defaultdict(set)

    for row in result.all():
        if len(sessions[row.id]) >= 3:
            continue
        if row.workout_id in seen_workouts[row.id]:
            continue

        weight = row.actual_weight if row.actual_weight is not None else row.weight
        reps = row.actual_reps if row.actual_reps is not None else row.reps
        rir = row.actual_rir if row.actual_rir is not None else row.rir

        if weight is None or reps is None:
            continue

        sessions[row.id].append({
            "date": row.date.isoformat(),
            "weight": float(weight),
            "reps": int(reps),
            "rir": int(rir) if rir is not None else None,
        })
        seen_workouts[row.id].add(row.workout_id)

    hints = []
    for ex_id, history in sessions.items():
        exercise = exercises.get(ex_id)
        if not exercise:
            continue
        suggestion = _summarize_history(history, exercise.type)
        hints.append({
            "exercise": exercise.name_canonical,
            "exercise_type": exercise.type,
            "recent_top_sets": history,
            "suggestion": suggestion,
        })

    return hints
