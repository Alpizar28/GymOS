"""Tests for the JSON import service."""

import json
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.database import Base
from src.models.exercises import Exercise, ExerciseStats
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState, Setting, WeekTemplate
from src.services.import_service import (
    import_athlete_profile,
    import_exercise_library,
    import_program_constraints,
    seed_anchor_targets,
    seed_athlete_state,
    seed_week_template,
)

# Use in-memory SQLite for tests
TEST_ENGINE = create_async_engine("sqlite+aiosqlite:///:memory:")
TestSession = async_sessionmaker(TEST_ENGINE, class_=AsyncSession, expire_on_commit=False)

# Paths to real JSON files
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ATHLETE_PROFILE = PROJECT_ROOT / "data" / "ATHLETE_PROFILE.json"
EXERCISE_LIBRARY = PROJECT_ROOT / "data" / "EXERCISE_LIBRARY.json"
PROGRAM_CONSTRAINTS = PROJECT_ROOT / "data" / "PROGRAM_CONSTRAINTS.json"


@pytest_asyncio.fixture
async def db_session():
    """Create a fresh in-memory DB for each test."""
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSession() as session:
        yield session

    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_import_athlete_profile(db_session):
    """Import ATHLETE_PROFILE.json → settings table."""
    if not ATHLETE_PROFILE.exists():
        pytest.skip("ATHLETE_PROFILE.json not found")

    count = await import_athlete_profile(db_session, ATHLETE_PROFILE)
    await db_session.commit()

    assert count > 0

    # Verify a known key
    result = await db_session.execute(
        select(Setting).where(Setting.key == "athlete_global_metrics")
    )
    setting = result.scalar_one_or_none()
    assert setting is not None
    data = json.loads(setting.value)
    assert data["total_sessions"] == 327


@pytest.mark.asyncio
async def test_import_exercise_library(db_session):
    """Import EXERCISE_LIBRARY.json → exercises + exercise_stats."""
    if not EXERCISE_LIBRARY.exists():
        pytest.skip("EXERCISE_LIBRARY.json not found")

    count = await import_exercise_library(db_session, EXERCISE_LIBRARY)
    await db_session.commit()

    # Should import a significant number of exercises
    assert count >= 50

    # Verify anchors got flagged
    result = await db_session.execute(
        select(Exercise).where(Exercise.is_anchor.is_(True))
    )
    anchors = result.scalars().all()
    assert len(anchors) > 0

    # Verify specific known anchor
    result = await db_session.execute(
        select(Exercise).where(Exercise.name_canonical == "Bench Press")
    )
    bench = result.scalar_one_or_none()
    assert bench is not None
    assert bench.is_anchor is True

    # Verify stats linked
    result = await db_session.execute(
        select(ExerciseStats).where(ExerciseStats.exercise_id == bench.id)
    )
    stats = result.scalar_one_or_none()
    assert stats is not None
    assert stats.max_weight == 240.0


@pytest.mark.asyncio
async def test_import_program_constraints(db_session):
    """Import PROGRAM_CONSTRAINTS.json → settings table."""
    if not PROGRAM_CONSTRAINTS.exists():
        pytest.skip("PROGRAM_CONSTRAINTS.json not found")

    count = await import_program_constraints(db_session, PROGRAM_CONSTRAINTS)
    await db_session.commit()

    assert count > 0

    # Verify volume limits
    result = await db_session.execute(
        select(Setting).where(Setting.key == "constraint_volume_limits")
    )
    setting = result.scalar_one_or_none()
    assert setting is not None
    data = json.loads(setting.value)
    assert data["avg_session_volume_lbs"] == 19036.0


@pytest.mark.asyncio
async def test_seed_week_template(db_session):
    """Seed 6-day training split."""
    count = await seed_week_template(db_session)
    await db_session.commit()

    assert count == 6

    result = await db_session.execute(select(WeekTemplate))
    days = result.scalars().all()
    assert len(days) == 6

    names = [d.name for d in days]
    assert "Push_Heavy" in names
    assert "Pull_Heavy" in names
    assert "Quads_Heavy" in names


@pytest.mark.asyncio
async def test_seed_anchor_targets(db_session):
    """Anchor targets created for is_anchor exercises."""
    if not EXERCISE_LIBRARY.exists():
        pytest.skip("EXERCISE_LIBRARY.json not found")

    await import_exercise_library(db_session, EXERCISE_LIBRARY)
    count = await seed_anchor_targets(db_session)
    await db_session.commit()

    assert count > 0

    result = await db_session.execute(select(AnchorTarget))
    targets = result.scalars().all()
    assert len(targets) == count

    # Each target should have a valid weight
    for target in targets:
        assert target.target_weight > 0
        assert target.status == "active"
