"""Plan generation models: Plan, PlanDay."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Plan(Base):
    """A training plan spanning multiple days."""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    goal: Mapped[str | None] = mapped_column(String(200), nullable=True)
    days_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=6)

    days: Mapped[list["PlanDay"]] = relationship(
        "PlanDay", back_populates="plan", cascade="all, delete-orphan"
    )


class PlanDay(Base):
    """A single day's plan within a Plan."""

    __tablename__ = "plan_days"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    template_day_name: Mapped[str] = mapped_column(String(50), nullable=False)
    content_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    validation_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="days")
