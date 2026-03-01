"""Exercise swap service: find alternatives for a given exercise."""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise, ExerciseStats

logger = logging.getLogger(__name__)


async def find_swap_candidates(
    session: AsyncSession,
    exercise_id: int,
    limit: int = 5,
) -> list[dict]:
    """
    Find swap candidates for an exercise based on:
    1. Same movement pattern
    2. Same primary muscle
    3. Exclude the current exercise
    4. Prefer exercises with higher frequency scores
    """
    # Get the source exercise
    result = await session.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        return []

    # Find exercises with same movement pattern and primary muscle
    result = await session.execute(
        select(Exercise, ExerciseStats)
        .outerjoin(ExerciseStats, Exercise.id == ExerciseStats.exercise_id)
        .where(
            Exercise.movement_pattern == source.movement_pattern,
            Exercise.primary_muscle == source.primary_muscle,
            Exercise.id != exercise_id,
        )
        .order_by(ExerciseStats.total_sets.desc().nullslast())
        .limit(limit)
    )
    candidates = result.all()

    # If not enough candidates, relax to just movement pattern
    if len(candidates) < limit:
        result = await session.execute(
            select(Exercise, ExerciseStats)
            .outerjoin(ExerciseStats, Exercise.id == ExerciseStats.exercise_id)
            .where(
                Exercise.movement_pattern == source.movement_pattern,
                Exercise.id != exercise_id,
            )
            .order_by(ExerciseStats.total_sets.desc().nullslast())
            .limit(limit)
        )
        candidates = result.all()

    seen_ids: set[int] = set()
    swaps: list[dict] = []
    for ex, stats in candidates:
        if ex.id in seen_ids:
            continue
        seen_ids.add(ex.id)
        swaps.append({
            "id": ex.id,
            "name": ex.name_canonical,
            "primary_muscle": ex.primary_muscle,
            "type": ex.type,
            "movement_pattern": ex.movement_pattern,
            "is_anchor": ex.is_anchor,
            "avg_weight": stats.avg_weight if stats else 0,
            "total_sets": stats.total_sets if stats else 0,
        })

    return swaps[:limit]
