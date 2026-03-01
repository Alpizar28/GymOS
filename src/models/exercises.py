"""Exercise library models: Exercise and ExerciseStats."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Exercise(Base):
    """Canonical exercise definition with metadata."""

    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_canonical: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    aliases_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON array
    primary_muscle: Mapped[str] = mapped_column(String(50), nullable=False, default="unknown")
    secondary_muscles_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="unknown"
    )  # compound/isolation
    movement_pattern: Mapped[str] = mapped_column(
        String(50), nullable=False, default="unknown"
    )  # hinge/squat/push/pull
    is_anchor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_staple: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stats: Mapped["ExerciseStats | None"] = relationship(
        "ExerciseStats", back_populates="exercise", uselist=False
    )


class ExerciseStats(Base):
    """Aggregated stats for an exercise, updated as workouts are logged."""

    __tablename__ = "exercise_stats"

    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id"), primary_key=True
    )
    avg_reps: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    frequency_score: Mapped[str] = mapped_column(
        String(20), nullable=False, default="low"
    )  # low/medium/high
    total_sets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    volume_contribution_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="stats")
