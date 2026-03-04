"""CLI script to seed the database from JSON artifacts."""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import async_session, init_db
from src.services.import_service import run_full_import

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Default paths relative to project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATHS = {
    "athlete_profile": PROJECT_ROOT / "data" / "ATHLETE_PROFILE.json",
    "exercise_library": PROJECT_ROOT / "data" / "EXERCISE_LIBRARY.json",
    "program_constraints": PROJECT_ROOT / "data" / "PROGRAM_CONSTRAINTS.json",
}


async def seed() -> None:
    """Run the full DB seed."""
    await init_db()
    logger.info("Database tables created")

    # Validate paths
    for name, path in DEFAULT_PATHS.items():
        if not path.exists():
            logger.error("Missing file: %s (expected at %s)", name, path)
            sys.exit(1)

    async with async_session() as session:
        results = await run_full_import(
            session=session,
            athlete_profile_path=DEFAULT_PATHS["athlete_profile"],
            exercise_library_path=DEFAULT_PATHS["exercise_library"],
            program_constraints_path=DEFAULT_PATHS["program_constraints"],
        )

    logger.info("Seed complete!")
    for key, count in results.items():
        logger.info("  %s: %d", key, count)


def main() -> None:
    """Entry point for the seed script."""
    asyncio.run(seed())


if __name__ == "__main__":
    main()
