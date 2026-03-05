"""Incremental seed for body metrics only."""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import async_session, init_db
from src.services.import_service import import_body_metrics_seed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed body metrics from JSON file")
    parser.add_argument(
        "--path",
        default=str(Path(__file__).resolve().parent.parent / "data" / "BODY_METRICS_SEED.json"),
        help="Path to body metrics seed JSON",
    )
    return parser.parse_args()


async def seed(path: Path) -> None:
    """Run body metrics seed without recreating the DB."""
    if not path.exists():
        logger.error("Missing body metrics seed: %s", path)
        sys.exit(1)

    await init_db()

    async with async_session() as session:
        inserted = await import_body_metrics_seed(session, path)
        await session.commit()

    logger.info("Body metrics seed complete: inserted=%d", inserted)


def main() -> None:
    args = _parse_args()
    asyncio.run(seed(Path(args.path)))


if __name__ == "__main__":
    main()
