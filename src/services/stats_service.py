"""Stats service: weekly summaries and anchor progress reports."""

import logging
from datetime import date, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet

logger = logging.getLogger(__name__)


async def get_weekly_summary(
    session: AsyncSession,
    reference_date: date | None = None,
) -> dict:
    """Generate a weekly stats summary."""
    ref = reference_date or date.today()
    week_start = ref - timedelta(days=ref.weekday())
    week_end = week_start + timedelta(days=6)

    # Count workouts this week
    count_result = await session.execute(
        select(func.count(Workout.id)).where(
            Workout.date >= week_start,
            Workout.date <= week_end,
        )
    )
    workout_count = count_result.scalar() or 0

    # Total sets this week
    sets_result = await session.execute(
        select(func.count(WorkoutSet.id))
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .where(Workout.date >= week_start, Workout.date <= week_end)
        .where(WorkoutSet.set_type == "normal")
    )
    total_sets = sets_result.scalar() or 0

    # Total volume this week
    volume_result = await session.execute(
        select(func.sum(WorkoutSet.weight * WorkoutSet.reps))
        .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .where(Workout.date >= week_start, Workout.date <= week_end)
        .where(WorkoutSet.set_type == "normal")
        .where(WorkoutSet.weight.is_not(None), WorkoutSet.reps.is_not(None))
    )
    total_volume = round(volume_result.scalar() or 0, 0)

    # Anchor progress
    anchor_progress = await get_anchor_progress(session)

    # Athlete state
    state_result = await session.execute(select(AthleteState).where(AthleteState.id == 1))
    state = state_result.scalar_one_or_none()

    return {
        "week": f"{week_start} → {week_end}",
        "workouts": workout_count,
        "total_sets": total_sets,
        "total_volume_lbs": total_volume,
        "fatigue_score": state.fatigue_score if state else 0,
        "next_day_index": state.next_day_index if state else 1,
        "anchor_progress": anchor_progress,
    }


async def get_anchor_progress(session: AsyncSession) -> list[dict]:
    """Get current state of all anchor targets."""
    result = await session.execute(
        select(AnchorTarget, Exercise.name_canonical)
        .join(Exercise, AnchorTarget.exercise_id == Exercise.id)
        .order_by(desc(AnchorTarget.target_weight))
    )

    progress = []
    for target, name in result.all():
        progress.append({
            "exercise": name,
            "target_weight": target.target_weight,
            "reps_range": f"{target.target_reps_min}-{target.target_reps_max}",
            "status": target.status,
            "streak": target.streak,
            "last_rir": target.last_rir,
        })

    return progress
