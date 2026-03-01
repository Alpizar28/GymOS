"""Progression tracking model: AnchorTarget."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class AnchorTarget(Base):
    """Progression target for an anchor exercise. Rules are deterministic, NOT LLM-driven."""

    __tablename__ = "anchor_targets"

    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id"), primary_key=True
    )
    target_weight: Mapped[float] = mapped_column(Float, nullable=False)
    target_reps_min: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    target_reps_max: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    rule_profile: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='{"increment_lbs": 5, "deload_pct": 0.1, "consolidation_sessions": 2}',
    )
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_rir: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active/deload/consolidate
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    exercise: Mapped["Exercise"] = relationship("Exercise")


from src.models.exercises import Exercise  # noqa: E402, F401
