"""Routine-specific anchor progression preview and apply helpers."""

from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.progression import AnchorTarget
from src.models.routines import Routine, RoutineExercise, RoutineSet
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet


def _normalize_set_type(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"working", "normal"}:
        return "working"
    if normalized == "approach":
        return "approach"
    if normalized == "warmup":
        return "warmup"
    if normalized == "drop":
        return "drop"
    return "working"


def _increment_for_type(exercise_type: str | None) -> float:
    return 5.0 if (exercise_type or "") == "compound" else 2.5


def _build_suggestion(history: list[dict], exercise_type: str | None) -> dict:
    if not history:
        return {
            "action": "maintain",
            "reason": "Sin historial suficiente",
            "apply_scope": "none",
        }

    last = history[0]
    prev = history[1] if len(history) > 1 else None
    prev2 = history[2] if len(history) > 2 else None
    increment = _increment_for_type(exercise_type)
    recent_rir_values = [row["rir"] for row in history if row.get("rir") is not None]
    high_rir_hits = sum(1 for rir in recent_rir_values if rir >= 2)

    rir = last.get("rir")
    if rir is not None:
        if rir >= 2:
            scope = "all_working_sets" if high_rir_hits >= 3 else "top_working_set"
            return {
                "action": "increase_weight",
                "delta_lbs": increment,
                "reason": "RIR reciente alto",
                "apply_scope": scope,
            }
        if rir == 1:
            return {
                "action": "increase_reps",
                "delta_reps": 1,
                "reason": "RIR 1: margen para una repeticion mas",
                "apply_scope": "all_working_sets",
            }
        if rir == 0:
            return {
                "action": "maintain",
                "reason": "RIR 0: consolidar antes de subir",
                "apply_scope": "none",
            }

    if prev and prev2:
        reps_triplet = [last.get("reps"), prev.get("reps"), prev2.get("reps")]
        if all(rep is not None for rep in reps_triplet):
            if reps_triplet[0] < reps_triplet[1] < reps_triplet[2]:
                return {
                    "action": "deload",
                    "reason": "Repeticiones en descenso continuo",
                    "apply_scope": "all_working_sets",
                }

    if prev and last.get("reps") is not None and prev.get("reps") is not None:
        if last["reps"] <= prev["reps"] and last.get("weight") == prev.get("weight"):
            return {
                "action": "increase_reps",
                "delta_reps": 1,
                "reason": "Mismo peso sin mejorar reps",
                "apply_scope": "all_working_sets",
            }

    if prev and prev2 and (exercise_type or "") != "compound":
        if (
            last.get("reps") == prev.get("reps") == prev2.get("reps")
            and last.get("weight") == prev.get("weight") == prev2.get("weight")
        ):
            return {
                "action": "add_set",
                "reason": "Estancamiento en accesorio",
                "apply_scope": "all_working_sets",
            }

    return {
        "action": "maintain",
        "reason": "Tendencia estable",
        "apply_scope": "none",
    }


async def _load_recent_history(
    session: AsyncSession,
    exercise_id: int,
    lookback: int,
) -> list[dict]:
    result = await session.execute(
        select(
            Workout.id.label("workout_id"),
            Workout.date,
            func.coalesce(WorkoutSet.actual_weight, WorkoutSet.weight).label("weight"),
            func.coalesce(WorkoutSet.actual_reps, WorkoutSet.reps).label("reps"),
            func.coalesce(WorkoutSet.actual_rir, WorkoutSet.rir).label("rir"),
        )
        .join(WorkoutExercise, WorkoutExercise.workout_id == Workout.id)
        .join(WorkoutSet, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .where(WorkoutExercise.exercise_id == exercise_id)
        .where(WorkoutSet.set_type == "normal")
        .order_by(
            desc(Workout.date),
            desc(Workout.id),
            desc(func.coalesce(WorkoutSet.actual_weight, WorkoutSet.weight)),
        )
    )

    history: list[dict] = []
    seen_workouts: set[int] = set()
    for row in result.all():
        if row.workout_id in seen_workouts:
            continue
        if row.weight is None or row.reps is None:
            continue
        history.append(
            {
                "date": row.date.isoformat(),
                "weight": float(row.weight),
                "reps": int(row.reps),
                "rir": int(row.rir) if row.rir is not None else None,
            }
        )
        seen_workouts.add(row.workout_id)
        if len(history) >= lookback:
            break

    return history


def _working_sets(exercise: RoutineExercise) -> list[RoutineSet]:
    return [
        routine_set
        for routine_set in sorted(exercise.sets, key=lambda item: item.set_index)
        if _normalize_set_type(routine_set.set_type) == "working"
    ]


def _build_adjustments(
    exercise: RoutineExercise,
    suggestion: dict,
    anchor_target_weight: float | None,
) -> tuple[list[dict], dict | None]:
    working = _working_sets(exercise)
    if not working:
        return [], None

    action = suggestion.get("action")
    updates: list[dict] = []
    new_set: dict | None = None

    if action == "increase_weight":
        delta = float(suggestion.get("delta_lbs") or 0)
        scope = suggestion.get("apply_scope")
        selected = working if scope == "all_working_sets" else working[:1]
        for routine_set in selected:
            base_weight = (
                routine_set.target_weight_lbs
                if routine_set.target_weight_lbs is not None
                else anchor_target_weight
            )
            if base_weight is None:
                continue
            updates.append(
                {
                    "set_index": routine_set.set_index,
                    "target_weight_lbs": round(base_weight + delta, 1),
                    "target_reps": routine_set.target_reps,
                }
            )

    elif action == "increase_reps":
        delta = int(suggestion.get("delta_reps") or 0)
        for routine_set in working:
            if routine_set.target_reps is None:
                continue
            updates.append(
                {
                    "set_index": routine_set.set_index,
                    "target_weight_lbs": routine_set.target_weight_lbs,
                    "target_reps": routine_set.target_reps + delta,
                }
            )

    elif action == "deload":
        for routine_set in working:
            if routine_set.target_weight_lbs is None:
                continue
            updates.append(
                {
                    "set_index": routine_set.set_index,
                    "target_weight_lbs": round(routine_set.target_weight_lbs * 0.9, 1),
                    "target_reps": routine_set.target_reps,
                }
            )

    elif action == "add_set":
        base = working[-1]
        new_set = {
            "set_type": base.set_type,
            "target_weight_lbs": base.target_weight_lbs,
            "target_reps": base.target_reps,
            "rir_target": base.rir_target,
        }

    return updates, new_set


async def build_routine_progression_preview(
    session: AsyncSession,
    routine: Routine,
    lookback: int = 5,
) -> list[dict]:
    anchors = [
        ex
        for ex in sorted(routine.exercises, key=lambda item: item.sort_order)
        if ex.exercise_id is not None and ex.exercise is not None and ex.exercise.is_anchor
    ]
    if not anchors:
        return []

    exercise_ids = [ex.exercise_id for ex in anchors if ex.exercise_id is not None]
    target_result = await session.execute(
        select(AnchorTarget).where(AnchorTarget.exercise_id.in_(exercise_ids))
    )
    targets = {target.exercise_id: target for target in target_result.scalars().all()}

    preview: list[dict] = []
    for routine_exercise in anchors:
        exercise = routine_exercise.exercise
        if not exercise:
            continue

        history = await _load_recent_history(session, exercise.id, lookback)
        suggestion = _build_suggestion(history, exercise.type)
        target = targets.get(exercise.id)
        updates, new_set = _build_adjustments(
            routine_exercise,
            suggestion,
            target.target_weight if target else None,
        )

        preview.append(
            {
                "routine_exercise_id": routine_exercise.id,
                "exercise_id": exercise.id,
                "exercise": exercise.name_canonical,
                "lookback_used": len(history),
                "recent_top_sets": history,
                "anchor_target": {
                    "target_weight": target.target_weight if target else None,
                    "target_reps_min": target.target_reps_min if target else None,
                    "target_reps_max": target.target_reps_max if target else None,
                    "status": target.status if target else None,
                },
                "suggestion": suggestion,
                "proposed_updates": updates,
                "proposed_new_set": new_set,
            }
        )

    return preview


async def apply_routine_progression(
    session: AsyncSession,
    routine: Routine,
    lookback: int = 5,
) -> dict:
    preview = await build_routine_progression_preview(session, routine, lookback=lookback)
    exercise_map = {ex.id: ex for ex in routine.exercises}

    updated_sets = 0
    added_sets = 0
    touched_exercises: set[int] = set()

    for item in preview:
        routine_exercise_id = item["routine_exercise_id"]
        routine_exercise = exercise_map.get(routine_exercise_id)
        if not routine_exercise:
            continue

        sets_by_index = {row.set_index: row for row in routine_exercise.sets}
        for update in item["proposed_updates"]:
            row = sets_by_index.get(update["set_index"])
            if row is None:
                continue
            row.target_weight_lbs = update["target_weight_lbs"]
            row.target_reps = update["target_reps"]
            session.add(row)
            updated_sets += 1
            touched_exercises.add(routine_exercise.id)

        new_set = item.get("proposed_new_set")
        if new_set is not None:
            next_index = max((s.set_index for s in routine_exercise.sets), default=-1) + 1
            created = RoutineSet(
                routine_exercise_id=routine_exercise.id,
                set_index=next_index,
                set_type=new_set["set_type"],
                target_weight_lbs=new_set["target_weight_lbs"],
                target_reps=new_set["target_reps"],
                rir_target=new_set["rir_target"],
            )
            session.add(created)
            added_sets += 1
            touched_exercises.add(routine_exercise.id)

    await session.flush()
    return {
        "updated_exercises": len(touched_exercises),
        "updated_sets": updated_sets,
        "added_sets": added_sets,
        "preview": preview,
    }
