"""Backfill workouts.training_type for historical data."""

import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import async_session, init_db
from src.services.history_backfill import backfill_workout_training_types

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def run_backfill() -> None:
    await init_db()
    logger.info("Database initialized")

    async with async_session() as session:
        user_id = os.getenv("BACKFILL_USER_ID", "00000000-0000-0000-0000-000000000001")
        result = await backfill_workout_training_types(session, user_id=user_id)
        await session.commit()

    logger.info("Backfill completed: %s", result)


def main() -> None:
    asyncio.run(run_backfill())


if __name__ == "__main__":
    main()
