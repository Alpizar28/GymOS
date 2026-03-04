"""Workout logging service: parses text input and stores sets."""

import json
import logging
import re
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise
from src.models.feedback import SessionFeedback
from src.models.settings import AthleteState
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet

logger = logging.getLogger(__name__)

# Pattern: "Exercise Name 185x6x3" or "Exercise Name 185x6, 180x8, 175x10"
# Also supports: "Exercise Name 185x6 RIR2" or "Exercise Name 185x6x3 drop"
SET_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:lbs?\s*)?x\s*(\d+)"  # weight x reps
    r"(?:\s*x\s*(\d+))?"  # optional x sets (shorthand)
    r"(?:\s*(?:rir|RIR)\s*(\d+))?"  # optional RIR
    r"(?:\s*(drop|warmup|warm))?"  # optional set type
)


async def find_exercise_by_name(session: AsyncSession, name: str) -> Exercise | None:
    """Find exercise by canonical name or alias (case-insensitive)."""
    # Try exact match first
    result = await session.execute(
        select(Exercise).where(func.lower(Exercise.name_canonical) == name.lower().strip())
    )
    exercise = result.scalar_one_or_none()
    if exercise:
        return exercise

    # Try partial match
    result = await session.execute(
        select(Exercise).where(func.lower(Exercise.name_canonical).contains(name.lower().strip()))
    )
    exercise = result.scalar_one_or_none()
    if exercise:
        return exercise

    # Try aliases
    all_exercises = await session.execute(select(Exercise))
    for ex in all_exercises.scalars().all():
        aliases = json.loads(ex.aliases_json)
        for alias in aliases:
            if alias.lower().strip() == name.lower().strip():
                return ex

    return None


def parse_exercise_line(line: str) -> tuple[str, list[dict]] | None:
    """
    Parse a single exercise line into (exercise_name, sets_list).

    Supported formats:
    - "Bench Press 185x6x3" → 3 sets of 185lbs x 6 reps
    - "Bench Press 185x6, 180x8, 175x10" → 3 different sets
    - "Bench Press 185x6 RIR2" → with RIR
    - "Bench Press 185x6 drop" → drop set
    """
    line = line.strip()
    if not line:
        return None

    # Find all set patterns in the line
    matches = list(SET_PATTERN.finditer(line))
    if not matches:
        return None

    # Exercise name is everything before the first number pattern
    first_match_start = matches[0].start()
    exercise_name = line[:first_match_start].strip().rstrip("-:").strip()
    if not exercise_name:
        return None

    sets_list: list[dict] = []
    for match in matches:
        weight = float(match.group(1))
        reps = int(match.group(2))
        num_sets = int(match.group(3)) if match.group(3) else 1
        rir = int(match.group(4)) if match.group(4) else None
        set_type_raw = match.group(5)

        set_type = "normal"
        if set_type_raw:
            if set_type_raw.lower() in ("drop",):
                set_type = "drop"
            elif set_type_raw.lower() in ("warmup", "warm"):
                set_type = "warmup"

        for _ in range(num_sets):
            sets_list.append({
                "weight": weight,
                "reps": reps,
                "rir": rir,
                "set_type": set_type,
            })

    return (exercise_name, sets_list)


async def log_workout(
    session: AsyncSession,
    text: str,
    workout_date: date | None = None,
    template_day_name: str | None = None,
    notes: str | None = None,
) -> Workout | None:
    """
    Parse free-text workout log and create Workout + WorkoutExercises + Sets.

    Input format (one exercise per line):
        Bench Press 185x6x3
        Machine Chest Fly 170x12, 160x12, 150x15 drop
        Dumbbell Lateral Raise 30x12x4

    Returns the created Workout or None if parsing failed.
    """
    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    if not lines:
        logger.warning("Empty workout text")
        return None

    workout = Workout(
        date=workout_date or date.today(),
        template_day_name=template_day_name,
        notes=notes,
    )
    session.add(workout)
    await session.flush()

    exercises_logged = 0
    unmatched: list[str] = []

    for idx, line in enumerate(lines):
        parsed = parse_exercise_line(line)
        if parsed is None:
            logger.warning("Could not parse line: %s", line)
            unmatched.append(line)
            continue

        exercise_name, sets_data = parsed
        exercise = await find_exercise_by_name(session, exercise_name)

        if exercise is None:
            logger.warning("Exercise not found: %s", exercise_name)
            unmatched.append(exercise_name)
            continue

        we = WorkoutExercise(
            workout_id=workout.id,
            exercise_id=exercise.id,
            order_index=idx,
        )
        session.add(we)
        await session.flush()

        for set_data in sets_data:
            workout_set = WorkoutSet(
                workout_exercise_id=we.id,
                set_type=set_data["set_type"],
                weight=set_data["weight"],
                reps=set_data["reps"],
                rir=set_data["rir"],
            )
            session.add(workout_set)

        exercises_logged += 1

    await session.flush()
    logger.info(
        "Logged workout %d: %d exercises, %d unmatched lines",
        workout.id,
        exercises_logged,
        len(unmatched),
    )

    return workout


async def log_manual_workout(
    session: AsyncSession,
    workout_date: date,
    template_day_name: str | None,
    notes: str | None,
    text: str | None = None,
    exercises: list[dict] | None = None,
) -> Workout | None:
    """Create a workout from free text or structured exercise data."""
    workout = Workout(
        date=workout_date,
        template_day_name=template_day_name,
        notes=notes,
    )
    session.add(workout)
    await session.flush()

    exercises_logged = 0
    unmatched: list[str] = []

    if text:
        lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
        for idx, line in enumerate(lines):
            parsed = parse_exercise_line(line)
            if parsed is None:
                unmatched.append(line)
                continue
            exercise_name, sets_data = parsed
            exercise = await find_exercise_by_name(session, exercise_name)
            if exercise is None:
                unmatched.append(exercise_name)
                continue

            we = WorkoutExercise(
                workout_id=workout.id,
                exercise_id=exercise.id,
                order_index=idx,
            )
            session.add(we)
            await session.flush()

            for set_data in sets_data:
                workout_set = WorkoutSet(
                    workout_exercise_id=we.id,
                    set_type=set_data["set_type"],
                    actual_weight=set_data["weight"],
                    actual_reps=set_data["reps"],
                    actual_rir=set_data.get("rir"),
                    completed=True,
                )
                session.add(workout_set)

            exercises_logged += 1

    if exercises:
        start_index = exercises_logged
        for offset, entry in enumerate(exercises):
            exercise = await find_exercise_by_name(session, entry["name"])
            if exercise is None:
                unmatched.append(entry["name"])
                continue

            we = WorkoutExercise(
                workout_id=workout.id,
                exercise_id=exercise.id,
                order_index=start_index + offset,
            )
            session.add(we)
            await session.flush()

            for set_data in entry.get("sets", []):
                workout_set = WorkoutSet(
                    workout_exercise_id=we.id,
                    set_type=set_data.get("set_type", "normal"),
                    actual_weight=set_data.get("weight"),
                    actual_reps=set_data.get("reps"),
                    actual_rir=set_data.get("rir"),
                    completed=True,
                )
                session.add(workout_set)

            exercises_logged += 1

    await session.flush()
    logger.info(
        "Manual workout %d: %d exercises, %d unmatched",
        workout.id,
        exercises_logged,
        len(unmatched),
    )

    return workout


async def complete_workout(
    session: AsyncSession,
    workout_id: int,
    fatigue: float,
) -> None:
    """Mark workout complete, save feedback, and advance day index."""
    feedback = SessionFeedback(
        workout_id=workout_id,
        fatigue=fatigue,
    )
    session.add(feedback)

    # Advance athlete state
    result = await session.execute(
        select(AthleteState).where(AthleteState.id == 1)
    )
    state = result.scalar_one_or_none()
    if state:
        state.next_day_index = (state.next_day_index % 6) + 1
        # Simple fatigue update: decayed average
        state.fatigue_score = round(state.fatigue_score * 0.7 + fatigue * 0.3, 1)
        session.add(state)

    await session.flush()
    logger.info("Workout %d completed, fatigue: %.1f", workout_id, fatigue)
