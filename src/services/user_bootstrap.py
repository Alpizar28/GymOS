"""Bootstrap per-user state for multi-tenant mode."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise, ExerciseStats
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState, Setting

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def ensure_user_bootstrap(session: AsyncSession, user_id: str) -> None:
    state_result = await session.execute(
        select(AthleteState).where(AthleteState.user_id == user_id)
    )
    state = state_result.scalar_one_or_none()
    if state is not None:
        return

    session.add(AthleteState(user_id=user_id, next_day_index=1, fatigue_score=0.0))

    defaults_result = await session.execute(
        select(Setting).where(
            Setting.user_id == DEFAULT_USER_ID,
            or_(
                func.lower(Setting.key).startswith("athlete_"),
                func.lower(Setting.key).startswith("constraint_"),
            ),
        )
    )
    for row in defaults_result.scalars().all():
        session.add(Setting(user_id=user_id, key=row.key, value=row.value))

    anchors_result = await session.execute(
        select(Exercise, ExerciseStats)
        .outerjoin(ExerciseStats, Exercise.id == ExerciseStats.exercise_id)
        .where(Exercise.is_anchor.is_(True))
    )
    for exercise, stats in anchors_result.all():
        session.add(
            AnchorTarget(
                user_id=user_id,
                exercise_id=exercise.id,
                target_weight=stats.avg_weight if stats and stats.avg_weight > 0 else 100.0,
                target_reps_min=5 if exercise.type == "compound" else 8,
                target_reps_max=8 if exercise.type == "compound" else 12,
                rule_profile='{"increment_lbs": 5, "deload_pct": 0.1, "consolidation_sessions": 2}',
                streak=0,
                status="active",
            )
        )

    await session.commit()
