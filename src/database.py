"""SQLAlchemy async engine and session factory."""

import logging
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


engine = create_async_engine(
    settings.database_url,
    echo=settings.log_level == "DEBUG",
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Dependency for FastAPI / services to get a DB session."""
    async with async_session() as session:
        yield session


async def init_db() -> None:
    """Create all tables and auto-seed on first startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Auto-seed if DB is empty (first boot in production Docker)
    await _auto_seed_if_empty()

    # Ensure new templates exist in existing DBs
    await _ensure_templates()

    # Keep cache tables lean and indexes in place
    await _run_db_hygiene()


async def _auto_seed_if_empty() -> None:
    """
    Run the full import if exercises table is empty.
    Safe to call on every startup — exits immediately if data exists.
    """
    from sqlalchemy import func

    # Import model here to avoid circular import during table creation
    from src.models.exercises import Exercise

    async with async_session() as session:
        result = await session.execute(select(func.count()).select_from(Exercise))
        count = result.scalar_one()

    if count > 0:
        logger.info("Database already seeded (%d exercises). Skipping.", count)
        return

    logger.info("Empty database detected — running auto-seed...")

    project_root = Path(__file__).resolve().parent.parent
    athlete_profile = project_root / "data" / "ATHLETE_PROFILE.json"
    exercise_library = project_root / "data" / "EXERCISE_LIBRARY.json"
    program_constraints = project_root / "data" / "PROGRAM_CONSTRAINTS.json"

    missing = [p for p in [athlete_profile, exercise_library, program_constraints] if not p.exists()]
    if missing:
        logger.error("Auto-seed skipped — missing JSON files: %s", missing)
        return

    from src.services.import_service import run_full_import

    async with async_session() as session:
        results = await run_full_import(
            session=session,
            athlete_profile_path=athlete_profile,
            exercise_library_path=exercise_library,
            program_constraints_path=program_constraints,
        )

    logger.info(
        "Auto-seed complete: %s",
        ", ".join(f"{k}={v}" for k, v in results.items()),
    )


async def _ensure_templates() -> None:
    from src.services.import_service import ensure_week_template
    from src.services.routine_bootstrap import ensure_default_routines

    async with async_session() as session:
        inserted = await ensure_week_template(session)
        routine_inserted = await ensure_default_routines(session)
        if inserted:
            await session.commit()
        elif routine_inserted:
            await session.commit()


async def _run_db_hygiene() -> None:
    from src.services.db_maintenance import run_database_hygiene

    async with async_session() as session:
        result = await run_database_hygiene(session)
        await session.commit()

    if result["plan_days_deduped"] or result["orphan_plans_removed"]:
        logger.info(
            "Database hygiene: deduped plan_days=%d, removed orphan plans=%d",
            result["plan_days_deduped"],
            result["orphan_plans_removed"],
        )
