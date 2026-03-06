"""Pain/protection mode service: reduces volume for affected muscle groups."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_user_id
from src.models.settings import Setting

logger = logging.getLogger(__name__)

# Protection mode reduces volume by this factor for affected muscles
PROTECTION_FACTOR = 0.5


async def activate_protection(
    session: AsyncSession,
    muscle_group: str,
    severity: int = 5,
) -> dict:
    """
    Activate protection mode for a muscle group.

    Stores the protection in settings as:
        key: "protection_{muscle_group}"
        value: {"active": true, "severity": N, "factor": 0.5}

    Returns the protection config.
    """
    key = f"protection_{muscle_group.lower().strip()}"
    user_id = get_current_user_id()
    factor = max(0.2, 1.0 - (severity / 10) * 0.8)  # severity 10 → 0.2x, severity 1 → 0.92x

    protection = {
        "active": True,
        "severity": severity,
        "muscle_group": muscle_group.lower().strip(),
        "factor": round(factor, 2),
    }

    # Upsert
    result = await session.execute(
        select(Setting).where(Setting.user_id == user_id, Setting.key == key)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = str(protection).replace("'", '"').replace("True", "true")
    else:
        session.add(
            Setting(
                user_id=user_id,
                key=key,
                value=str(protection).replace("'", '"').replace("True", "true"),
            )
        )

    await session.flush()
    logger.info("Protection activated: %s (severity %d, factor %.2f)", muscle_group, severity, factor)
    return protection


async def deactivate_protection(session: AsyncSession, muscle_group: str) -> bool:
    """Deactivate protection mode for a muscle group."""
    key = f"protection_{muscle_group.lower().strip()}"
    user_id = get_current_user_id()
    result = await session.execute(
        select(Setting).where(Setting.user_id == user_id, Setting.key == key)
    )
    existing = result.scalar_one_or_none()

    if existing:
        await session.delete(existing)
        await session.flush()
        logger.info("Protection deactivated: %s", muscle_group)
        return True
    return False


async def get_active_protections(session: AsyncSession) -> list[dict]:
    """Get all active muscle group protections."""
    import json

    result = await session.execute(
        select(Setting).where(
            Setting.user_id == get_current_user_id(),
            Setting.key.like("protection_%"),
        )
    )
    protections = []
    for setting in result.scalars().all():
        try:
            data = json.loads(setting.value)
            if data.get("active"):
                protections.append(data)
        except (json.JSONDecodeError, AttributeError):
            continue
    return protections
