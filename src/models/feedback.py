"""Session feedback model for fatigue and pain tracking."""

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class SessionFeedback(Base):
    """Post-workout feedback: fatigue, soreness, pain flags."""

    __tablename__ = "session_feedback"

    workout_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workouts.id"), primary_key=True
    )
    soreness_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # {"chest": 5, "shoulders": 3}
    fatigue: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)  # 0-10
    pain_flags_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # ["left_shoulder", "lower_back"]

    workout: Mapped["Workout"] = relationship("Workout", back_populates="feedback")


from src.models.workouts import Workout  # noqa: E402, F401
