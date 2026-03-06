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
    "CREATE INDEX IF NOT EXISTS idx_routines_training_type ON routines(training_type)",
    "CREATE INDEX IF NOT EXISTS idx_workouts_training_type ON workouts(training_type)",
    "CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date)",
    "CREATE INDEX IF NOT EXISTS idx_plans_user_date ON plans(user_id, start_date)",
    "CREATE INDEX IF NOT EXISTS idx_settings_user_key ON settings(user_id, key)",
    "CREATE INDEX IF NOT EXISTS idx_athlete_state_user ON athlete_state(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_routines_user_folder ON routines(user_id, folder_id)",
    "CREATE INDEX IF NOT EXISTS idx_routine_folders_user_sort ON routine_folders(user_id, sort_order)",
    "CREATE INDEX IF NOT EXISTS idx_anchor_targets_user_exercise ON anchor_targets(user_id, exercise_id)",
]

SCHEMA_PATCHES = [
    {
        "table": "settings",
        "column": "user_id",
        "statement": "ALTER TABLE settings ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "athlete_state",
        "column": "user_id",
        "statement": "ALTER TABLE athlete_state ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "workouts",
        "column": "user_id",
        "statement": "ALTER TABLE workouts ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "plans",
        "column": "user_id",
        "statement": "ALTER TABLE plans ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "routine_folders",
        "column": "user_id",
        "statement": "ALTER TABLE routine_folders ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "routines",
        "column": "user_id",
        "statement": "ALTER TABLE routines ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "anchor_targets",
        "column": "user_id",
        "statement": "ALTER TABLE anchor_targets ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'",
    },
    {
        "table": "routines",
        "column": "training_type",
        "statement": "ALTER TABLE routines ADD COLUMN training_type TEXT NOT NULL DEFAULT 'custom'",
    },
    {
        "table": "workouts",
        "column": "training_type",
        "statement": "ALTER TABLE workouts ADD COLUMN training_type TEXT",
    },
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
    bind = session.bind
    dialect = bind.dialect.name if bind is not None else ""

    schema_patches_applied = 0
    for patch in SCHEMA_PATCHES:
        if dialect == "sqlite":
            result = await session.execute(text(f"PRAGMA table_info({patch['table']})"))
            columns = {row[1] for row in result.fetchall()}
        else:
            result = await session.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                    """
                ),
                {"table_name": patch["table"]},
            )
            columns = {row[0] for row in result.fetchall()}
        if patch["column"] not in columns:
            await session.execute(text(patch["statement"]))
            schema_patches_applied += 1

    for statement in INDEX_STATEMENTS:
        await session.execute(text(statement))

    dedupe_result = await session.execute(text(DEDUP_PLAN_DAYS_SQL))
    orphan_result = await session.execute(text(DELETE_ORPHAN_PLANS_SQL))

    return {
        "plan_days_deduped": dedupe_result.rowcount or 0,
        "orphan_plans_removed": orphan_result.rowcount or 0,
        "indexes_checked": len(INDEX_STATEMENTS),
        "schema_patches_applied": schema_patches_applied,
    }
