"""Copy GymOS data from SQLite into PostgreSQL/Supabase.

Usage:
    SQLITE_PATH=./gym.db \
    DATABASE_URL=postgresql+asyncpg://... \
    python scripts/migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import asyncio
import os
import sqlite3

from sqlalchemy import text

from src.database import async_session

TABLE_ORDER = [
    "exercises",
    "exercise_stats",
    "week_template",
    "settings",
    "athlete_state",
    "routine_folders",
    "routines",
    "routine_exercises",
    "routine_sets",
    "anchor_targets",
    "plans",
    "plan_days",
    "workouts",
    "workout_exercises",
    "sets",
    "session_feedback",
]

USER_SCOPED_TABLES = {
    "settings",
    "athlete_state",
    "workouts",
    "plans",
    "routine_folders",
    "routines",
    "anchor_targets",
}


def _fetch_rows(conn: sqlite3.Connection, table: str) -> tuple[list[str], list[tuple]]:
    cursor = conn.execute(f"SELECT * FROM {table}")
    cols = [item[0] for item in cursor.description]
    rows = cursor.fetchall()
    return cols, rows


async def _copy_table(table: str, cols: list[str], rows: list[tuple]) -> int:
    if not rows:
        return 0

    target_cols = cols.copy()
    if table in USER_SCOPED_TABLES and "user_id" not in target_cols:
        target_cols.append("user_id")

    placeholders = ", ".join([f":{c}" for c in target_cols])
    columns = ", ".join(target_cols)
    statement = text(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})")

    migration_user_id = os.getenv("MIGRATION_USER_ID", "00000000-0000-0000-0000-000000000001")
    payload = []
    for row in rows:
        record = dict(zip(cols, row, strict=False))
        if table in USER_SCOPED_TABLES and "user_id" not in record:
            record["user_id"] = migration_user_id
        payload.append(record)

    async with async_session() as session:
        await session.execute(statement, payload)
        await session.commit()
    return len(payload)


async def main() -> None:
    sqlite_path = os.getenv("SQLITE_PATH", "./gym.db")
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite file not found: {sqlite_path}")

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        total = 0
        for table in TABLE_ORDER:
            cols, rows = _fetch_rows(conn, table)
            copied = await _copy_table(table, cols, rows)
            total += copied
            print(f"{table}: {copied} rows")
        print(f"Done. Total rows copied: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    asyncio.run(main())
