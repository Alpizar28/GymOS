"""Migrate data from SQLite to Postgres using async SQLAlchemy."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from src.config import settings
from src.database import Base
import src.models  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000


def _get_source_url() -> str:
    return os.getenv("SQLITE_DATABASE_URL", settings.database_url)


def _get_target_url() -> str:
    target = os.getenv("POSTGRES_DATABASE_URL")
    if not target:
        raise ValueError("POSTGRES_DATABASE_URL is required")
    return target


async def _copy_table(
    *,
    table,
    source_engine: AsyncEngine,
    target_engine: AsyncEngine,
) -> int:
    inserted = 0
    async with source_engine.connect() as source_conn:
        result = await source_conn.execute(select(table))
        while True:
            rows: Sequence = result.fetchmany(CHUNK_SIZE)
            if not rows:
                break
            payload = [dict(row._mapping) for row in rows]
            async with target_engine.begin() as target_conn:
                await target_conn.execute(table.insert(), payload)
            inserted += len(payload)
    return inserted


async def migrate() -> None:
    source_url = _get_source_url()
    target_url = _get_target_url()

    source_engine = create_async_engine(source_url)
    target_engine = create_async_engine(target_url)

    try:
        for table in Base.metadata.sorted_tables:
            logger.info("Migrating table: %s", table.name)
            count = await _copy_table(
                table=table,
                source_engine=source_engine,
                target_engine=target_engine,
            )
            logger.info("Inserted %d rows into %s", count, table.name)
    finally:
        await source_engine.dispose()
        await target_engine.dispose()


def main() -> None:
    asyncio.run(migrate())


if __name__ == "__main__":
    main()
