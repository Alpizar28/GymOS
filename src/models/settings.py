"""Config & state models: user settings, templates, athlete state."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class Setting(Base):
    """Per-user key-value store for app config and profile JSON blobs."""

    __tablename__ = "settings"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_settings_user_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string


class WeekTemplate(Base):
    """Training template definition."""

    __tablename__ = "week_template"

    day_index: Mapped[int] = mapped_column(Integer, primary_key=True)  # 1-6
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "Push_Heavy"
    focus: Mapped[str] = mapped_column(String(200), nullable=False)  # human description
    rules_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: anchors, constraints


class AthleteState(Base):
    """Per-user row tracking current athlete state."""

    __tablename__ = "athlete_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    next_day_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fatigue_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
