"""Routine library models: folders, routines, exercises, and sets."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class RoutineFolder(Base):
    """Folder used to organize reusable routines."""

    __tablename__ = "routine_folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    routines: Mapped[list["Routine"]] = relationship(
        "Routine",
        back_populates="folder",
        cascade="all, delete-orphan",
    )


class Routine(Base):
    """Reusable routine template with ordered exercises and sets."""

    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    folder_id: Mapped[int] = mapped_column(Integer, ForeignKey("routine_folders.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(220), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    training_type: Mapped[str] = mapped_column(String(20), nullable=False, default="custom")
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    folder: Mapped["RoutineFolder"] = relationship("RoutineFolder", back_populates="routines")
    exercises: Mapped[list["RoutineExercise"]] = relationship(
        "RoutineExercise",
        back_populates="routine",
        cascade="all, delete-orphan",
    )


class RoutineExercise(Base):
    """Ordered exercise inside a routine."""

    __tablename__ = "routine_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    routine_id: Mapped[int] = mapped_column(Integer, ForeignKey("routines.id"), nullable=False)
    exercise_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("exercises.id"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    routine: Mapped["Routine"] = relationship("Routine", back_populates="exercises")
    exercise: Mapped["Exercise | None"] = relationship("Exercise")
    sets: Mapped[list["RoutineSet"]] = relationship(
        "RoutineSet",
        back_populates="routine_exercise",
        cascade="all, delete-orphan",
    )


class RoutineSet(Base):
    """Target set prescription for a routine exercise."""

    __tablename__ = "routine_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    routine_exercise_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("routine_exercises.id"),
        nullable=False,
    )
    set_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    set_type: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    target_weight_lbs: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rir_target: Mapped[int | None] = mapped_column(Integer, nullable=True)

    routine_exercise: Mapped["RoutineExercise"] = relationship(
        "RoutineExercise",
        back_populates="sets",
    )


from src.models.exercises import Exercise  # noqa: E402, F401
