"""Backfill helpers for workout training_type classification."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.routines import Routine
from src.models.workouts import Workout

VALID_TRAINING_TYPES = {"push", "pull", "legs", "custom"}


def _normalize_template_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^A-Za-z0-9_ ]+", " ", value)
    normalized = normalized.replace("_", " ").lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _classify_training_type(name: str | None) -> str:
    normalized = _normalize_template_name(name)
    if not normalized:
        return "custom"

    push_tokens = ["push", "pecho", "hombro", "tricep", "triceps"]
    pull_tokens = ["pull", "espalda", "biceps", "dorsal", "row"]
    legs_tokens = [
        "legs",
        "leg",
        "pierna",
        "cuadriceps",
        "femorales",
        "hamstring",
        "glute",
        "calf",
        "squat",
        "posterior",
    ]

    is_push = any(token in normalized for token in push_tokens)
    is_pull = any(token in normalized for token in pull_tokens)
    is_legs = any(token in normalized for token in legs_tokens)

    matched = [is_push, is_pull, is_legs].count(True)
    if matched != 1:
        return "custom"
    if is_push:
        return "push"
    if is_pull:
        return "pull"
    return "legs"


async def backfill_workout_training_types(session: AsyncSession, user_id: str) -> dict:
    """Populate workouts.training_type from routine names and name heuristics."""
    routines_result = await session.execute(
        select(Routine.name, Routine.training_type).where(
            Routine.user_id == user_id,
            Routine.is_deleted.is_(False),
        )
    )

    routine_lookup: dict[str, str] = {}
    for routine_name, training_type in routines_result.all():
        normalized_name = _normalize_template_name(routine_name)
        normalized_type = (training_type or "custom").strip().lower()
        if normalized_name and normalized_type in VALID_TRAINING_TYPES:
            routine_lookup[normalized_name] = normalized_type

    workouts_result = await session.execute(
        select(Workout).where(Workout.user_id == user_id).order_by(Workout.id)
    )
    workouts = workouts_result.scalars().all()

    updated = 0
    upgraded_from_custom = 0
    matched_routine = 0
    matched_heuristic = 0

    for workout in workouts:
        current = (workout.training_type or "").strip().lower()
        normalized_template = _normalize_template_name(workout.template_day_name)
        from_routine = routine_lookup.get(normalized_template)
        desired = "custom"
        if from_routine:
            desired = from_routine
            matched_routine += 1
        else:
            desired = _classify_training_type(workout.template_day_name)
            matched_heuristic += 1

        # Keep existing non-custom classifications as authoritative.
        # But allow custom/invalid historical values to be upgraded.
        should_update = False
        if current not in VALID_TRAINING_TYPES:
            should_update = True
        elif current == "custom" and desired != "custom":
            should_update = True
            upgraded_from_custom += 1

        if not should_update:
            continue

        workout.training_type = desired

        session.add(workout)
        updated += 1

    return {
        "workouts_scanned": len(workouts),
        "updated": updated,
        "upgraded_from_custom": upgraded_from_custom,
        "matched_routine": matched_routine,
        "matched_heuristic": matched_heuristic,
    }
