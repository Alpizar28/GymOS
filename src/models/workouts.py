"""Workout session models: Workout, WorkoutExercise, WorkoutSet."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Workout(Base):
    """A single training session."""

    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bodyweight: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_day_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    training_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        "WorkoutExercise", back_populates="workout", cascade="all, delete-orphan"
    )
    feedback: Mapped["SessionFeedback | None"] = relationship(
        "SessionFeedback", back_populates="workout", uselist=False
    )


class WorkoutExercise(Base):
    """An exercise performed within a workout, preserving order."""

    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workout_id: Mapped[int] = mapped_column(Integer, ForeignKey("workouts.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(Integer, ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    workout: Mapped["Workout"] = relationship("Workout", back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship("Exercise")
    sets: Mapped[list["WorkoutSet"]] = relationship(
        "WorkoutSet", back_populates="workout_exercise", cascade="all, delete-orphan"
    )


class WorkoutSet(Base):
    """A single set within a workout exercise."""

    __tablename__ = "sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workout_exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workout_exercises.id"), nullable=False
    )
    set_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="normal"
    )  # normal/warmup/drop

    # --- Planned values (from plan generator, copied at log time) ---
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)  # kept for bot compat
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rir: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    planned_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    planned_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    planned_rir: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Actual logged values (filled by web UI or bot /done) ---
    actual_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_rir: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed: Mapped[bool] = mapped_column(Integer, nullable=False, default=False)

    workout_exercise: Mapped["WorkoutExercise"] = relationship(
        "WorkoutExercise", back_populates="sets"
    )


# Avoid circular import — these are used as string refs in relationship()
from src.models.exercises import Exercise  # noqa: E402, F401
from src.models.feedback import SessionFeedback  # noqa: E402, F401
