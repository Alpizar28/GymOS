"""FastAPI REST API for the web dashboard."""

import json
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select

from src.database import async_session
from src.models.exercises import Exercise, ExerciseStats
from src.models.plans import Plan, PlanDay
from src.models.progression import AnchorTarget
from src.models.settings import AthleteState, WeekTemplate
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet
from src.services.plan_generator import generate_day_plan
from src.services.recommendation_service import suggest_day
from src.services.stats_service import get_anchor_progress, get_weekly_summary
from src.services.workout_logger import log_manual_workout

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/health", include_in_schema=False)
async def health() -> dict:
    """Healthcheck endpoint for Docker and load balancers."""
    return {"status": "ok"}


# --- Response Models ---


class AthleteStateResponse(BaseModel):
    next_day_index: int
    next_day_name: str
    fatigue_score: float


class DashboardResponse(BaseModel):
    state: AthleteStateResponse
    last_plan: dict | None
    weekly_stats: dict
    recommendation: dict | None = None


class DayRecommendationResponse(BaseModel):
    day_name: str
    reason: str


class DayOptionResponse(BaseModel):
    name: str
    focus: str


class DayOptionCreate(BaseModel):
    name: str | None = None
    focus: str
    rules: dict


class ManualSet(BaseModel):
    weight: float | None = None
    reps: int | None = None
    rir: int | None = None
    set_type: str | None = None


class ManualExercise(BaseModel):
    name: str
    sets: list[ManualSet]


class ManualWorkoutRequest(BaseModel):
    date: str
    day_name: str | None = None
    notes: str | None = None
    text: str | None = None
    exercises: list[ManualExercise] | None = None


class ExerciseResponse(BaseModel):
    id: int
    name: str
    primary_muscle: str
    type: str
    movement_pattern: str
    is_anchor: bool
    is_staple: bool
    avg_weight: float
    max_weight: float
    avg_reps: float
    frequency_score: str
    total_sets: int


class WorkoutSummary(BaseModel):
    id: int
    date: str
    template_day_name: str | None
    duration_min: int | None
    exercise_count: int
    total_sets: int


class WorkoutDetail(BaseModel):
    id: int
    date: str
    template_day_name: str | None
    duration_min: int | None
    notes: str | None
    exercises: list[dict]


class AnchorProgressResponse(BaseModel):
    exercise: str
    exercise_id: int
    target_weight: float
    reps_range: str
    status: str
    streak: int
    last_rir: int | None
    history: list[dict]


# --- Dashboard ---


@router.get("/dashboard")
async def get_dashboard() -> DashboardResponse:
    """Main dashboard: athlete state + last plan + weekly stats."""
    async with async_session() as session:
        # Athlete state
        state_result = await session.execute(select(AthleteState).where(AthleteState.id == 1))
        state = state_result.scalar_one_or_none()

        # Get day name
        day_name = "Rest"
        if state:
            template_result = await session.execute(
                select(WeekTemplate).where(WeekTemplate.day_index == state.next_day_index)
            )
            template = template_result.scalar_one_or_none()
            day_name = template.name if template else "Unknown"

        # Last plan
        plan_result = await session.execute(
            select(PlanDay).order_by(desc(PlanDay.id)).limit(1)
        )
        last_plan_day = plan_result.scalar_one_or_none()
        last_plan = json.loads(last_plan_day.content_json) if last_plan_day else None

        # Weekly stats
        stats = await get_weekly_summary(session)

        recommendation = await suggest_day(session)

        return DashboardResponse(
            state=AthleteStateResponse(
                next_day_index=state.next_day_index if state else 1,
                next_day_name=day_name,
                fatigue_score=state.fatigue_score if state else 0.0,
            ),
            last_plan=last_plan,
            weekly_stats=stats,
            recommendation=recommendation,
        )


@router.post("/generate-today")
async def api_generate_today() -> dict:
    """Generate today's plan via the API."""
    async with async_session() as session:
        plan = await generate_day_plan(session)
        if plan is None:
            raise HTTPException(status_code=500, detail="Failed to generate plan")
        return plan


class GenerateDayRequest(BaseModel):
    day_name: str


@router.post("/generate-day")
async def api_generate_day(payload: GenerateDayRequest) -> dict:
    """Generate a plan for a specific day name."""
    async with async_session() as session:
        plan = await generate_day_plan(session, day_name=payload.day_name)
        if plan is None:
            raise HTTPException(status_code=404, detail="Day template not found")
        return plan


# --- Workouts ---


@router.get("/workouts")
async def list_workouts(limit: int = 30) -> list[WorkoutSummary]:
    """List recent workouts."""
    async with async_session() as session:
        result = await session.execute(
            select(Workout).order_by(desc(Workout.date)).limit(limit)
        )
        workouts = result.scalars().all()

        summaries = []
        for w in workouts:
            # Count exercises and sets
            ex_result = await session.execute(
                select(WorkoutExercise).where(WorkoutExercise.workout_id == w.id)
            )
            exercises = ex_result.scalars().all()
            total_sets = 0
            for ex in exercises:
                sets_result = await session.execute(
                    select(WorkoutSet).where(WorkoutSet.workout_exercise_id == ex.id)
                )
                total_sets += len(sets_result.scalars().all())

            summaries.append(WorkoutSummary(
                id=w.id,
                date=str(w.date),
                template_day_name=w.template_day_name,
                duration_min=w.duration_min,
                exercise_count=len(exercises),
                total_sets=total_sets,
            ))
        return summaries


@router.get("/workouts/{workout_id}")
async def get_workout(workout_id: int) -> WorkoutDetail:
    """Get detailed workout with all exercises and sets."""
    async with async_session() as session:
        result = await session.execute(select(Workout).where(Workout.id == workout_id))
        workout = result.scalar_one_or_none()
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")

        ex_result = await session.execute(
            select(WorkoutExercise, Exercise.name_canonical)
            .join(Exercise, WorkoutExercise.exercise_id == Exercise.id)
            .where(WorkoutExercise.workout_id == workout_id)
            .order_by(WorkoutExercise.order_index)
        )

        exercises = []
        for we, name in ex_result.all():
            sets_result = await session.execute(
                select(WorkoutSet)
                .where(WorkoutSet.workout_exercise_id == we.id)
                .order_by(WorkoutSet.id)
            )
            sets = [
                {
                    "set_type": s.set_type,
                    "weight": s.weight,
                    "reps": s.reps,
                    "rir": s.rir,
                }
                for s in sets_result.scalars().all()
            ]
            exercises.append({"name": name, "order": we.order_index, "sets": sets})

        return WorkoutDetail(
            id=workout.id,
            date=str(workout.date),
            template_day_name=workout.template_day_name,
            duration_min=workout.duration_min,
            notes=workout.notes,
            exercises=exercises,
        )


# --- Today's Workout Logger ---


class SetLogEntry(BaseModel):
    index: int
    actual_weight: float | None = None
    actual_reps: int | None = None
    actual_rir: int | None = None
    completed: bool = False


class ExerciseLogEntry(BaseModel):
    name: str
    sets: list[SetLogEntry]


class TodayLogRequest(BaseModel):
    day_name: str
    exercises: list[ExerciseLogEntry]


@router.get("/today")
async def get_today_plan() -> dict:
    """Return today's latest generated plan for the interactive logger UI."""
    async with async_session() as session:
        plan_result = await session.execute(
            select(PlanDay).order_by(desc(PlanDay.id)).limit(1)
        )
        plan_day = plan_result.scalar_one_or_none()
        if not plan_day:
            raise HTTPException(
                status_code=404,
                detail="No plan generated yet. Choose a day in /today or generate from the Dashboard.",
            )

        content = json.loads(plan_day.content_json)
        return {
            "plan_id": plan_day.id,
            "day_name": content.get("day_name", ""),
            "estimated_duration_min": content.get("estimated_duration_min"),
            "total_sets": content.get("total_sets"),
            "exercises": [
                {
                    "name": ex["name"],
                    "is_anchor": ex.get("is_anchor", False),
                    "notes": ex.get("notes", ""),
                    "sets": [
                        {
                            "index": si,
                            "set_type": s.get("set_type", "normal"),
                            "weight_lbs": s.get("weight_lbs"),
                            "target_reps": s.get("target_reps"),
                            "rir_target": s.get("rir_target"),
                            "rest_seconds": s.get("rest_seconds"),
                        }
                        for si, s in enumerate(ex.get("sets", []))
                    ],
                }
                for ex in content.get("exercises", [])
            ],
        }


@router.post("/today/log")
async def log_today_workout(payload: TodayLogRequest) -> dict:
    """
    Idempotently save/update today's workout log from the web UI.
    Creates a new Workout for today or updates the existing one.
    """
    today = date.today()
    async with async_session() as session:
        existing = await session.execute(
            select(Workout)
            .where(Workout.date == today)
            .where(Workout.template_day_name == payload.day_name)
            .limit(1)
        )
        workout = existing.scalar_one_or_none()
        created = workout is None

        if created:
            workout = Workout(date=today, template_day_name=payload.day_name)
            session.add(workout)
            await session.flush()

        for ex_entry in payload.exercises:
            ex_result = await session.execute(
                select(Exercise).where(
                    Exercise.name_canonical.ilike(ex_entry.name)
                ).limit(1)
            )
            exercise = ex_result.scalar_one_or_none()
            if not exercise:
                continue

            we_result = await session.execute(
                select(WorkoutExercise)
                .where(WorkoutExercise.workout_id == workout.id)
                .where(WorkoutExercise.exercise_id == exercise.id)
            )
            we = we_result.scalar_one_or_none()
            if not we:
                we = WorkoutExercise(
                    workout_id=workout.id, exercise_id=exercise.id, order_index=0
                )
                session.add(we)
                await session.flush()

            existing_sets_result = await session.execute(
                select(WorkoutSet)
                .where(WorkoutSet.workout_exercise_id == we.id)
                .order_by(WorkoutSet.id)
            )
            existing_sets = existing_sets_result.scalars().all()

            for set_entry in ex_entry.sets:
                idx = set_entry.index
                if idx < len(existing_sets):
                    s = existing_sets[idx]
                else:
                    s = WorkoutSet(workout_exercise_id=we.id, set_type="normal")
                    session.add(s)

                if set_entry.actual_weight is not None:
                    s.actual_weight = set_entry.actual_weight
                    s.weight = set_entry.actual_weight
                if set_entry.actual_reps is not None:
                    s.actual_reps = set_entry.actual_reps
                    s.reps = set_entry.actual_reps
                if set_entry.actual_rir is not None:
                    s.actual_rir = set_entry.actual_rir
                    s.rir = set_entry.actual_rir
                s.completed = set_entry.completed

        await session.commit()

        # ── PR Detection ──────────────────────────────────────────
        prs: list[dict] = []
        for ex_entry in payload.exercises:
            ex_result2 = await session.execute(
                select(Exercise).where(Exercise.name_canonical.ilike(ex_entry.name)).limit(1)
            )
            exercise2 = ex_result2.scalar_one_or_none()
            if not exercise2:
                continue

            stats_result = await session.execute(
                select(ExerciseStats).where(ExerciseStats.exercise_id == exercise2.id)
            )
            stats = stats_result.scalar_one_or_none()
            hist_max_weight = stats.max_weight if stats else 0
            hist_max_e1rm = stats.max_weight * (1 + (stats.avg_reps or 5) / 30) if stats and stats.max_weight else 0

            for s in ex_entry.sets:
                if not s.actual_weight or not s.actual_reps:
                    continue
                e1rm = round(s.actual_weight * (1 + s.actual_reps / 30), 1)

                if s.actual_weight > (hist_max_weight or 0):
                    prs.append({"exercise": ex_entry.name, "type": "weight", "value": s.actual_weight})
                    break
                if e1rm > (hist_max_e1rm or 0):
                    prs.append({"exercise": ex_entry.name, "type": "e1rm", "value": e1rm})
                    break

        return {"workout_id": workout.id, "created": created, "prs": prs}


@router.get("/exercises/{exercise_name}/last-session")
async def get_last_exercise_session(exercise_name: str) -> list[dict]:
    """Return the sets from the most recent workout session that included this exercise."""
    async with async_session() as session:
        ex_result = await session.execute(
            select(Exercise).where(Exercise.name_canonical.ilike(exercise_name)).limit(1)
        )
        exercise = ex_result.scalar_one_or_none()
        if not exercise:
            return []

        # Most recent WorkoutExercise for this exercise
        we_result = await session.execute(
            select(WorkoutExercise)
            .join(Workout, WorkoutExercise.workout_id == Workout.id)
            .where(WorkoutExercise.exercise_id == exercise.id)
            .order_by(desc(Workout.date), desc(WorkoutExercise.id))
            .limit(1)
        )
        we = we_result.scalar_one_or_none()
        if not we:
            return []

        sets_result = await session.execute(
            select(WorkoutSet)
            .where(WorkoutSet.workout_exercise_id == we.id)
            .order_by(WorkoutSet.id)
        )
        return [
            {
                "weight": s.actual_weight or s.weight,
                "reps": s.actual_reps or s.reps,
                "rir": s.actual_rir or s.rir,
                "set_type": s.set_type,
            }
            for s in sets_result.scalars().all()
            if (s.actual_weight or s.weight)  # skip empty sets
        ]


# --- Exercises / Library ---


@router.get("/exercises")
async def list_exercises() -> list[ExerciseResponse]:
    """List all exercises with stats."""
    async with async_session() as session:
        result = await session.execute(
            select(Exercise, ExerciseStats)
            .outerjoin(ExerciseStats, Exercise.id == ExerciseStats.exercise_id)
            .order_by(desc(ExerciseStats.total_sets))
        )

        return [
            ExerciseResponse(
                id=ex.id,
                name=ex.name_canonical,
                primary_muscle=ex.primary_muscle,
                type=ex.type,
                movement_pattern=ex.movement_pattern,
                is_anchor=ex.is_anchor,
                is_staple=ex.is_staple,
                avg_weight=stats.avg_weight if stats else 0,
                max_weight=stats.max_weight if stats else 0,
                avg_reps=stats.avg_reps if stats else 0,
                frequency_score=stats.frequency_score if stats else "low",
                total_sets=stats.total_sets if stats else 0,
            )
            for ex, stats in result.all()
        ]


# --- Progress ---


@router.get("/progress")
async def get_progress() -> list[AnchorProgressResponse]:
    """Get anchor exercise progression with history."""
    async with async_session() as session:
        result = await session.execute(
            select(AnchorTarget, Exercise.name_canonical)
            .join(Exercise, AnchorTarget.exercise_id == Exercise.id)
            .order_by(desc(AnchorTarget.target_weight))
        )

        progress = []
        for target, name in result.all():
            # Get historical sets for this exercise
            history_result = await session.execute(
                select(WorkoutSet.weight, WorkoutSet.reps, Workout.date)
                .join(WorkoutExercise, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
                .join(Workout, WorkoutExercise.workout_id == Workout.id)
                .where(WorkoutExercise.exercise_id == target.exercise_id)
                .where(WorkoutSet.set_type == "normal")
                .order_by(Workout.date)
            )

            history = []
            seen_dates: set[str] = set()
            for weight, reps, d in history_result.all():
                date_str = str(d)
                if date_str not in seen_dates and weight and reps:
                    # Take first (heaviest) set per date for the chart
                    history.append({
                        "date": date_str,
                        "weight": weight,
                        "reps": reps,
                        "estimated_1rm": round(weight * (1 + reps / 30), 1),
                    })
                    seen_dates.add(date_str)

            progress.append(AnchorProgressResponse(
                exercise=name,
                exercise_id=target.exercise_id,
                target_weight=target.target_weight,
                reps_range=f"{target.target_reps_min}-{target.target_reps_max}",
                status=target.status,
                streak=target.streak,
                last_rir=target.last_rir,
                history=history,
            ))

        return progress


# --- Weekly Stats ---


@router.get("/stats/weekly")
async def api_weekly_stats() -> dict:
    """Get weekly stats summary."""
    async with async_session() as session:
        return await get_weekly_summary(session)


@router.get("/week-template")
async def get_week_template() -> list[dict]:
    """Get the 6-day training split."""
    async with async_session() as session:
        result = await session.execute(
            select(WeekTemplate)
            .where(WeekTemplate.day_index <= 6)
            .order_by(WeekTemplate.day_index)
        )
        return [
            {
                "day_index": t.day_index,
                "name": t.name,
                "focus": t.focus,
                "rules": json.loads(t.rules_json),
            }
            for t in result.scalars().all()
        ]


@router.get("/day-options")
async def get_day_options() -> list[DayOptionResponse]:
    """Get all available day templates for manual selection."""
    async with async_session() as session:
        result = await session.execute(select(WeekTemplate).order_by(WeekTemplate.day_index))
        return [
            DayOptionResponse(name=t.name, focus=t.focus)
            for t in result.scalars().all()
        ]


def _normalize_template_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_ ]+", "", name.strip())
    return re.sub(r"\s+", "_", cleaned)


@router.post("/day-options")
async def create_day_option(payload: DayOptionCreate) -> DayOptionResponse:
    """Create a custom day template."""
    if not payload.focus.strip():
        raise HTTPException(status_code=400, detail="Focus is required")

    raw_name = payload.name.strip() if payload.name else payload.focus
    name = _normalize_template_name(raw_name)
    if not name:
        raise HTTPException(status_code=400, detail="Invalid template name")

    rules = payload.rules or {}
    if not rules.get("required_patterns") and not rules.get("primary_muscles"):
        raise HTTPException(status_code=400, detail="Provide required_patterns or primary_muscles")

    async with async_session() as session:
        existing = await session.execute(select(WeekTemplate).where(WeekTemplate.name == name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Template already exists")

        max_index_result = await session.execute(select(WeekTemplate.day_index))
        max_index = max([idx for (idx,) in max_index_result.all()] or [0])

        template = WeekTemplate(
            day_index=max_index + 1,
            name=name,
            focus=payload.focus.strip(),
            rules_json=json.dumps(rules),
        )
        session.add(template)
        await session.commit()

    return DayOptionResponse(name=name, focus=payload.focus.strip())


@router.get("/day-recommendation")
async def get_day_recommendation() -> DayRecommendationResponse:
    """Get the recommended training day based on recent history."""
    async with async_session() as session:
        rec = await suggest_day(session)
        return DayRecommendationResponse(**rec)


@router.get("/calendar")
async def get_calendar(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
) -> list[dict]:
    """Get workouts grouped by day within a date range."""
    start = date.fromisoformat(from_date)
    end = date.fromisoformat(to_date)
    if end < start:
        raise HTTPException(status_code=400, detail="Invalid date range")

    async with async_session() as session:
        result = await session.execute(
            select(
                Workout.id,
                Workout.date,
                Workout.template_day_name,
                Workout.duration_min,
                func.count(WorkoutSet.id).label("set_count"),
                func.sum(
                    func.coalesce(WorkoutSet.actual_weight, WorkoutSet.weight)
                    * func.coalesce(WorkoutSet.actual_reps, WorkoutSet.reps)
                ).label("volume"),
            )
            .join(WorkoutExercise, WorkoutExercise.workout_id == Workout.id)
            .join(WorkoutSet, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
            .where(Workout.date >= start, Workout.date <= end)
            .where(WorkoutSet.set_type == "normal")
            .group_by(Workout.id)
            .order_by(Workout.date.desc())
        )

        workouts_by_date: dict[date, list[dict]] = {}
        for row in result.all():
            workouts_by_date.setdefault(row.date, []).append({
                "id": row.id,
                "date": row.date.isoformat(),
                "day_name": row.template_day_name,
                "duration_min": row.duration_min,
                "total_sets": int(row.set_count or 0),
                "total_volume_lbs": float(row.volume or 0),
            })

        days = []
        current = start
        while current <= end:
            days.append({
                "date": current.isoformat(),
                "workouts": workouts_by_date.get(current, []),
            })
            current += timedelta(days=1)

        return days


@router.post("/workouts/manual")
async def create_manual_workout(payload: ManualWorkoutRequest) -> dict:
    """Create a workout on a specific date (backfill)."""
    if not payload.text and not payload.exercises:
        raise HTTPException(status_code=400, detail="Provide text or exercises")

    try:
        workout_date = date.fromisoformat(payload.date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc

    async with async_session() as session:
        workout = await log_manual_workout(
            session=session,
            workout_date=workout_date,
            template_day_name=payload.day_name,
            notes=payload.notes,
            text=payload.text,
            exercises=[e.dict() for e in payload.exercises] if payload.exercises else None,
        )
        if workout is None:
            raise HTTPException(status_code=400, detail="Unable to parse workout")
        await session.commit()
        return {"workout_id": workout.id}


# ─── Complete Session (advance day + fatigue) ─────────────────────────────────


class CompleteSessionRequest(BaseModel):
    workout_id: int
    fatigue: float  # 1-10


@router.post("/today/complete")
async def complete_today_session(payload: CompleteSessionRequest) -> dict:
    """
    Mark today's session as complete, save fatigue rating, and advance the day index.
    Mirrors what /done did in the Telegram bot.
    """
    from src.models.feedback import SessionFeedback

    async with async_session() as session:
        # Verify workout exists
        workout = await session.get(Workout, payload.workout_id)
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")

        # Save fatigue feedback
        feedback = SessionFeedback(
            workout_id=payload.workout_id,
            fatigue=payload.fatigue,
        )
        session.add(feedback)

        # Advance athlete state
        state_result = await session.execute(select(AthleteState).where(AthleteState.id == 1))
        state = state_result.scalar_one_or_none()
        if state:
            state.next_day_index = (state.next_day_index % 6) + 1
            state.fatigue_score = round(state.fatigue_score * 0.7 + payload.fatigue * 0.3, 1)
            session.add(state)

        await session.commit()
        return {
            "workout_id": payload.workout_id,
            "next_day_index": state.next_day_index if state else 1,
            "fatigue_saved": payload.fatigue,
        }


# ─── Week Plan ────────────────────────────────────────────────────────────────


@router.get("/week")
async def get_week_plan() -> list[dict]:
    """
    Return a 6-day plan. Each day is served from PlanDay cache if available,
    otherwise returns the week template metadata for that day.
    """
    async with async_session() as session:
        templates_result = await session.execute(
            select(WeekTemplate)
            .where(WeekTemplate.day_index <= 6)
            .order_by(WeekTemplate.day_index)
        )
        templates = templates_result.scalars().all()

        # Get the last generated plan per day_name from PlanDay cache
        plans_result = await session.execute(
            select(PlanDay).order_by(desc(PlanDay.id))
        )
        plans_by_day: dict[str, dict] = {}
        for p in plans_result.scalars().all():
            content = json.loads(p.content_json)
            day_name = content.get("day_name", "")
            if day_name and day_name not in plans_by_day:
                plans_by_day[day_name] = content

        week = []
        for t in templates:
            plan = plans_by_day.get(t.name)
            week.append({
                "day_index": t.day_index,
                "name": t.name,
                "focus": t.focus,
                "has_plan": plan is not None,
                "plan": plan,
            })
        return week


@router.post("/week/generate")
async def generate_week() -> list[dict]:
    """Generate all 6 days of the week plan sequentially."""
    async with async_session() as session:
        templates_result = await session.execute(
            select(WeekTemplate)
            .where(WeekTemplate.day_index <= 6)
            .order_by(WeekTemplate.day_index)
        )
        templates = templates_result.scalars().all()

    days = []
    for template in templates:
        async with async_session() as session:
            plan = await generate_day_plan(session, day_index=template.day_index)
            if plan:
                days.append({"day_index": template.day_index, "name": template.name, "plan": plan})
    return days


# ─── Exercise Alternatives (Swap) ─────────────────────────────────────────────


@router.get("/exercises/{exercise_name}/alternatives")
async def get_exercise_alternatives(exercise_name: str, limit: int = 5) -> list[dict]:
    """Find swap candidates for a given exercise name."""
    from src.services.swap_service import find_swap_candidates

    async with async_session() as session:
        # Find exercise by name
        result = await session.execute(
            select(Exercise).where(Exercise.name_canonical.ilike(exercise_name)).limit(1)
        )
        exercise = result.scalar_one_or_none()
        if not exercise:
            raise HTTPException(status_code=404, detail=f"Exercise '{exercise_name}' not found")

        candidates = await find_swap_candidates(session, exercise.id, limit=limit)
        return candidates


# ─── Protection Manager ────────────────────────────────────────────────────────


class ProtectionRequest(BaseModel):
    muscle_group: str
    severity: int = 5  # 1-10


@router.get("/protection")
async def list_protections() -> list[dict]:
    """List all active muscle group protections."""
    from src.services.protection_service import get_active_protections

    async with async_session() as session:
        return await get_active_protections(session)


@router.post("/protection")
async def add_protection(payload: ProtectionRequest) -> dict:
    """Activate protection mode for a muscle group."""
    from src.services.protection_service import activate_protection

    async with async_session() as session:
        result = await activate_protection(session, payload.muscle_group, payload.severity)
        await session.commit()
        return result


@router.delete("/protection/{muscle_group}")
async def remove_protection(muscle_group: str) -> dict:
    """Deactivate protection mode for a muscle group."""
    from src.services.protection_service import deactivate_protection

    async with async_session() as session:
        removed = await deactivate_protection(session, muscle_group)
        await session.commit()
        if not removed:
            raise HTTPException(status_code=404, detail=f"No active protection for '{muscle_group}'")
        return {"removed": muscle_group}
