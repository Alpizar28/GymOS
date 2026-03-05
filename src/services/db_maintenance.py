"""Database hygiene helpers: dedupe cache rows and create indexes."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS idx_workouts_date_template ON workouts(date, template_day_name)",
    "CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order ON workout_exercises(workout_id, order_index)",
    "CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises(exercise_id)",
    "CREATE INDEX IF NOT EXISTS idx_sets_workout_exercise ON sets(workout_exercise_id)",
    "CREATE INDEX IF NOT EXISTS idx_plan_days_date_template ON plan_days(date, template_day_name)",
    "CREATE INDEX IF NOT EXISTS idx_plan_days_template_name ON plan_days(template_day_name)",
    "CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_sort ON routine_exercises(routine_id, sort_order)",
    "CREATE INDEX IF NOT EXISTS idx_routine_sets_exercise_index ON routine_sets(routine_exercise_id, set_index)",
]


DEDUP_PLAN_DAYS_SQL = """
DELETE FROM plan_days
WHERE id IN (
  SELECT older.id
  FROM plan_days AS older
  JOIN plan_days AS newer
    ON newer.date = older.date
   AND newer.template_day_name = older.template_day_name
   AND newer.id > older.id
)
"""


DELETE_ORPHAN_PLANS_SQL = """
DELETE FROM plans
WHERE id NOT IN (SELECT DISTINCT plan_id FROM plan_days)
"""


async def run_database_hygiene(session: AsyncSession) -> dict:
    """Run lightweight DB optimization and cleanup tasks."""
    for statement in INDEX_STATEMENTS:
        await session.execute(text(statement))

    dedupe_result = await session.execute(text(DEDUP_PLAN_DAYS_SQL))
    orphan_result = await session.execute(text(DELETE_ORPHAN_PLANS_SQL))

    return {
        "plan_days_deduped": dedupe_result.rowcount or 0,
        "orphan_plans_removed": orphan_result.rowcount or 0,
        "indexes_checked": len(INDEX_STATEMENTS),
    }
