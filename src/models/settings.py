"""Config & state models: Settings, WeekTemplate, AthleteState."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class Setting(Base):
    """Key-value store for app config (athlete profile, constraints, etc.)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string


class WeekTemplate(Base):
    """6-day training split definition."""

    __tablename__ = "week_template"

    day_index: Mapped[int] = mapped_column(Integer, primary_key=True)  # 1-6
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "Push_Heavy"
    focus: Mapped[str] = mapped_column(String(200), nullable=False)  # human description
    rules_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: anchors, constraints


class AthleteState(Base):
    """Singleton row tracking current athlete state."""

    __tablename__ = "athlete_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    next_day_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fatigue_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
