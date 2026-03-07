"""FastAPI REST API for the web dashboard."""

import json
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload

from src.auth import get_current_user_id
from src.database import async_session
from src.models.body_metrics import BodyMetric
from src.models.exercises import Exercise, ExerciseStats
from src.models.plans import Plan, PlanDay
from src.models.progression import AnchorTarget
from src.models.routines import Routine, RoutineExercise, RoutineFolder, RoutineSet
from src.models.settings import AthleteState, Setting, WeekTemplate
from src.models.workouts import Workout, WorkoutExercise, WorkoutSet
from src.services.plan_generator import generate_day_plan
from src.services.body_metrics_service import (
    get_body_metrics_summary,
    get_latest_body_metric,
    import_body_metrics,
    list_body_metrics,
    parse_csv_records,
    parse_date_bound,
)
from src.services.recommendation_service import suggest_day
from src.services.routine_progression_service import (
    apply_routine_progression,
    build_routine_progression_preview,
)
from src.services.stats_service import get_anchor_progress, get_weekly_summary
from src.services.workout_logger import log_manual_workout

router = APIRouter(prefix="/api", tags=["api"])

TRAINING_TYPE_VALUES = {"all", "push", "pull", "legs", "custom"}
ROUTINE_TRAINING_TYPE_VALUES = {"push", "pull", "legs", "custom"}


def _classify_training_type(template_day_name: str | None) -> str:
    if not template_day_name:
        return "custom"

    normalized = template_day_name.replace("_", " ").lower()
    push_tokens = ["push", "pecho", "hombro", "tricep", "triceps"]
    pull_tokens = ["pull", "espalda", "biceps", "dorsal", "row"]
    legs_tokens = [
        "legs",
        "leg",
        "pierna",
        "cuadriceps",
        "femorales",
        "hamstring",
        "glute",
        "calf",
        "squat",
    ]

    is_push = any(token in normalized for token in push_tokens)
    is_pull = any(token in normalized for token in pull_tokens)
    is_legs = any(token in normalized for token in legs_tokens)

    matched = [is_push, is_pull, is_legs].count(True)
    if matched != 1:
        return "custom"
    if is_push:
        return "push"
    if is_pull:
        return "pull"
    return "legs"


def _compute_delta_pct(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


async def _aggregate_week_window(
    *,
    session,
    start: date,
    end: date,
    training_type: str,
) -> dict:
    user_id = get_current_user_id()
    result = await session.execute(
        select(
            Workout.id,
            Workout.template_day_name,
            Workout.training_type,
            func.count(WorkoutSet.id).label("set_count"),
            func.sum(
                func.coalesce(WorkoutSet.actual_weight, WorkoutSet.weight)
                * func.coalesce(WorkoutSet.actual_reps, WorkoutSet.reps)
            ).label("volume"),
        )
        .join(WorkoutExercise, WorkoutExercise.workout_id == Workout.id)
        .join(WorkoutSet, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
        .where(Workout.user_id == user_id)
        .where(Workout.date >= start, Workout.date <= end)
        .where(WorkoutSet.set_type == "normal")
        .group_by(Workout.id)
    )

    sessions = 0
    total_sets = 0
    total_volume = 0.0
    for row in result.all():
        stored_type = (row.training_type or "").strip().lower()
        detected_type = (
            stored_type
            if stored_type in ROUTINE_TRAINING_TYPE_VALUES
            else _classify_training_type(row.template_day_name)
        )
        if training_type != "all" and detected_type != training_type:
            continue
        sessions += 1
        total_sets += int(row.set_count or 0)
        total_volume += float(row.volume or 0)

    return {
        "sessions": sessions,
        "sets": total_sets,
        "volume": round(total_volume, 2),
    }


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
    exercises: list[str] = []


class StrictRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DayOptionCreate(StrictRequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    focus: str = Field(min_length=1, max_length=80)
    rules: dict


HIDDEN_SYSTEM_TEMPLATE_NAMES = {
    "Push_Heavy",
    "Pull_Heavy",
    "Quads_Heavy",
    "Upper_Complement",
    "Arms_Shoulders",
    "Posterior_Heavy",
}


class ManualSet(StrictRequestModel):
    weight: float | None = Field(default=None, ge=0, le=2000)
    reps: int | None = Field(default=None, ge=0, le=200)
    rir: int | None = Field(default=None, ge=0, le=10)
    set_type: str | None = Field(default=None, pattern=r"^(normal|warmup|drop)$")


class ManualExercise(StrictRequestModel):
    name: str = Field(min_length=1, max_length=120)
    sets: list[ManualSet] = Field(min_length=1, max_length=30)


class ManualWorkoutRequest(StrictRequestModel):
    date: str
    day_name: str | None = Field(default=None, min_length=1, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    text: str | None = Field(default=None, max_length=12000)
    exercises: list[ManualExercise] | None = Field(default=None, max_length=60)


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


class ExerciseCreateRequest(StrictRequestModel):
    name: str = Field(min_length=1, max_length=120)
    primary_muscle: str | None = Field(default=None, min_length=1, max_length=50)
    type: str | None = Field(default=None, min_length=1, max_length=50)
    movement_pattern: str | None = Field(default=None, min_length=1, max_length=50)
    is_anchor: bool = False
    is_staple: bool = False


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


class RoutineSetInput(StrictRequestModel):
    set_type: str = Field(default="normal", pattern=r"^(normal|warmup|drop|approach|working)$")
    target_weight_lbs: float | None = Field(default=None, ge=0, le=2000)
    target_reps: int | None = Field(default=None, ge=0, le=200)
    rir_target: int | None = Field(default=None, ge=0, le=10)


class RoutineExerciseInput(StrictRequestModel):
    name: str = Field(min_length=1, max_length=120)
    exercise_id: int | None = Field(default=None, ge=1)
    rest_seconds: int | None = Field(default=None, ge=15, le=900)
    notes: str | None = Field(default=None, max_length=500)
    sets: list[RoutineSetInput] = Field(min_length=1, max_length=30)


class RoutineCreateRequest(StrictRequestModel):
    folder_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=100)
    subtitle: str | None = Field(default=None, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    training_type: str = Field(default="custom", pattern=r"^(push|pull|legs|custom)$")
    sort_order: int | None = Field(default=None, ge=0, le=10000)
    exercises: list[RoutineExerciseInput] = Field(default_factory=list, max_length=60)


class RoutineUpdateRequest(StrictRequestModel):
    folder_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    subtitle: str | None = Field(default=None, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    training_type: str | None = Field(default=None, pattern=r"^(push|pull|legs|custom)$")
    sort_order: int | None = Field(default=None, ge=0, le=10000)
    exercises: list[RoutineExerciseInput] | None = Field(default=None, max_length=60)


class RoutineFolderCreateRequest(StrictRequestModel):
    name: str = Field(min_length=1, max_length=80)


class RoutineFolderUpdateRequest(StrictRequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int | None = Field(default=None, ge=0, le=10000)


class PersonalProfileResponse(BaseModel):
    full_name: str
    photo_url: str | None = None
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_unit: str = "lb"
    weight_lbs: float | None = None
    body_fat_pct: float | None = None
    primary_goal: str | None = None
    goal_detail: str | None = None
    target_weight_lbs: float | None = None
    timeline_weeks: int | None = None
    training_years: float | None = None
    days_per_week: int | None = None
    session_duration_min: int | None = None
    preferred_split: str | None = None
    preferred_short_bar_lbs: float | None = 35
    equipment_access: list[str] = Field(default_factory=list)
    injuries: list[dict] = Field(default_factory=list)
    limitations: str | None = None
    exercise_likes: list[str] = Field(default_factory=list)
    exercise_dislikes: list[str] = Field(default_factory=list)
    sleep_hours: float | None = None
    stress_level: str | None = None
    activity_level: str | None = None
    nutrition_notes: str | None = None
    goal: str | None = None
    notes: str | None = None


class PersonalProfileUpdateRequest(StrictRequestModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=80)
    photo_url: str | None = Field(default=None, max_length=2048)
    age: int | None = Field(default=None, ge=10, le=110)
    sex: str | None = Field(default=None, pattern=r"^(male|female|other|prefer_not_to_say)$")
    height_cm: float | None = Field(default=None, ge=90, le=260)
    weight_unit: str | None = Field(default=None, pattern=r"^(lb|kg)$")
    weight_lbs: float | None = Field(default=None, ge=50, le=900)
    body_fat_pct: float | None = Field(default=None, ge=2, le=80)
    primary_goal: str | None = Field(
        default=None,
        pattern=r"^(fat_loss|muscle_gain|recomp|strength|performance|health)$",
    )
    goal_detail: str | None = Field(default=None, max_length=300)
    target_weight_lbs: float | None = Field(default=None, ge=50, le=900)
    timeline_weeks: int | None = Field(default=None, ge=1, le=260)
    training_years: float | None = Field(default=None, ge=0, le=60)
    days_per_week: int | None = Field(default=None, ge=1, le=7)
    session_duration_min: int | None = Field(default=None, ge=20, le=240)
    preferred_split: str | None = Field(default=None, max_length=80)
    preferred_short_bar_lbs: float | None = Field(default=None, ge=0, le=100)
    equipment_access: list[str] | None = Field(default=None, max_length=20)
    injuries: list[dict] | None = Field(default=None, max_length=30)
    limitations: str | None = Field(default=None, max_length=1000)
    exercise_likes: list[str] | None = Field(default=None, max_length=100)
    exercise_dislikes: list[str] | None = Field(default=None, max_length=100)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    stress_level: str | None = Field(default=None, pattern=r"^(low|medium|high)$")
    activity_level: str | None = Field(
        default=None,
        pattern=r"^(sedentary|light|moderate|high|athlete)$",
    )
    nutrition_notes: str | None = Field(default=None, max_length=1000)
    goal: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)


class OnboardingStatusResponse(BaseModel):
    completed: bool
    completed_at: str | None = None
    version: int = 1


class BodyMetricImportRequest(StrictRequestModel):
    source: str = Field(default="manual", min_length=1, max_length=50)
    records: list[dict] | None = Field(default=None, max_length=5000)
    csv_text: str | None = Field(default=None, max_length=200000)


class BodyMetricResponse(BaseModel):
    id: int
    measured_at: str
    source: str
    weight_kg: float | None
    body_fat_pct: float | None
    muscle_mass_kg: float | None
    notes: str | None
    created_at: str


class BodyMetricSummaryResponse(BaseModel):
    has_data: bool
    latest: BodyMetricResponse | None
    delta_7d_weight_kg: float | None
    delta_30d_weight_kg: float | None


def _body_metric_to_payload(metric: BodyMetric) -> BodyMetricResponse:
    return BodyMetricResponse(
        id=metric.id,
        measured_at=metric.measured_at.isoformat(),
        source=metric.source,
        weight_kg=metric.weight_kg,
        body_fat_pct=metric.body_fat_pct,
        muscle_mass_kg=metric.muscle_mass_kg,
        notes=metric.notes,
        created_at=metric.created_at.isoformat(),
    )


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
    user_id = get_current_user_id()
    async with async_session() as session:
        # Athlete state
        state_result = await session.execute(
            select(AthleteState).where(AthleteState.user_id == user_id)
        )
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
            select(PlanDay)
            .join(Plan, PlanDay.plan_id == Plan.id)
            .where(Plan.user_id == user_id)
            .order_by(desc(PlanDay.id))
            .limit(1)
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


class GenerateDayRequest(StrictRequestModel):
    day_name: str = Field(min_length=1, max_length=80)


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
async def list_workouts(limit: int = Query(default=30, ge=1, le=200)) -> list[WorkoutSummary]:
    """List recent workouts."""
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(Workout)
            .where(Workout.user_id == user_id)
            .order_by(desc(Workout.date))
            .limit(limit)
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
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
        )
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
                    "weight": s.actual_weight if s.actual_weight is not None else s.weight,
                    "reps": s.actual_reps if s.actual_reps is not None else s.reps,
                    "rir": s.actual_rir if s.actual_rir is not None else s.rir,
                    "completed": bool(s.completed),
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


class SetLogEntry(StrictRequestModel):
    index: int = Field(ge=0, le=100)
    set_type: str = Field(default="normal", pattern=r"^(normal|warmup|approach|drop)$")
    actual_weight: float | None = Field(default=None, ge=0, le=2000)
    actual_reps: int | None = Field(default=None, ge=0, le=200)
    actual_rir: int | None = Field(default=None, ge=0, le=10)
    completed: bool = False


class ExerciseLogEntry(StrictRequestModel):
    name: str = Field(min_length=1, max_length=120)
    sets: list[SetLogEntry] = Field(min_length=1, max_length=30)


class TodayLogRequest(StrictRequestModel):
    day_name: str = Field(min_length=1, max_length=80)
    training_type: str | None = Field(default=None, pattern=r"^(push|pull|legs|custom)$")
    exercises: list[ExerciseLogEntry] = Field(min_length=1, max_length=60)


@router.get("/today")
async def get_today_plan() -> dict:
    """Return today's latest generated plan for the interactive logger UI."""
    user_id = get_current_user_id()
    async with async_session() as session:
        plan_result = await session.execute(
            select(PlanDay)
            .join(Plan, PlanDay.plan_id == Plan.id)
            .where(Plan.user_id == user_id)
            .order_by(desc(PlanDay.id))
            .limit(1)
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
            "training_type": content.get("training_type"),
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
    user_id = get_current_user_id()
    async with async_session() as session:
        existing = await session.execute(
            select(Workout)
            .where(Workout.user_id == user_id)
            .where(Workout.date == today)
            .where(Workout.template_day_name == payload.day_name)
            .order_by(desc(Workout.id))
            .limit(1)
        )
        workout = existing.scalar_one_or_none()
        created = workout is None

        if created:
            workout = Workout(
                user_id=user_id,
                date=today,
                template_day_name=payload.day_name,
                training_type=payload.training_type,
            )
            session.add(workout)
            await session.flush()
        else:
            workout.training_type = payload.training_type

        kept_workout_exercise_ids: set[int] = set()

        for ex_idx, ex_entry in enumerate(payload.exercises):
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
                    workout_id=workout.id, exercise_id=exercise.id, order_index=ex_idx
                )
                session.add(we)
                await session.flush()
            else:
                we.order_index = ex_idx

            kept_workout_exercise_ids.add(we.id)

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

                s.actual_weight = set_entry.actual_weight
                s.weight = set_entry.actual_weight
                s.actual_reps = set_entry.actual_reps
                s.reps = set_entry.actual_reps
                s.actual_rir = set_entry.actual_rir
                s.rir = set_entry.actual_rir
                s.set_type = set_entry.set_type
                s.completed = set_entry.completed

            if len(existing_sets) > len(ex_entry.sets):
                for stale_set in existing_sets[len(ex_entry.sets):]:
                    await session.delete(stale_set)

        all_workout_exercises_result = await session.execute(
            select(WorkoutExercise).where(WorkoutExercise.workout_id == workout.id)
        )
        for workout_exercise in all_workout_exercises_result.scalars().all():
            if workout_exercise.id not in kept_workout_exercise_ids:
                await session.delete(workout_exercise)

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
    user_id = get_current_user_id()
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
            .where(Workout.user_id == user_id)
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


@router.post("/exercises")
async def create_exercise(payload: ExerciseCreateRequest) -> ExerciseResponse:
    """Create a new exercise in the library."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Exercise name is required")

    primary_muscle = (payload.primary_muscle or "unknown").strip().lower() or "unknown"
    exercise_type = (payload.type or "unknown").strip().lower() or "unknown"
    movement_pattern = (payload.movement_pattern or "unknown").strip().lower() or "unknown"

    async with async_session() as session:
        existing_result = await session.execute(
            select(Exercise).where(func.lower(Exercise.name_canonical) == name.lower()).limit(1)
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Exercise already exists")

        exercise = Exercise(
            name_canonical=name,
            aliases_json="[]",
            primary_muscle=primary_muscle,
            secondary_muscles_json="[]",
            type=exercise_type,
            movement_pattern=movement_pattern,
            is_anchor=payload.is_anchor,
            is_staple=payload.is_staple,
        )
        session.add(exercise)
        await session.commit()
        await session.refresh(exercise)

        return ExerciseResponse(
            id=exercise.id,
            name=exercise.name_canonical,
            primary_muscle=exercise.primary_muscle,
            type=exercise.type,
            movement_pattern=exercise.movement_pattern,
            is_anchor=exercise.is_anchor,
            is_staple=exercise.is_staple,
            avg_weight=0,
            max_weight=0,
            avg_reps=0,
            frequency_score="low",
            total_sets=0,
        )


# --- Progress ---


@router.get("/progress")
async def get_progress() -> list[AnchorProgressResponse]:
    """Get anchor exercise progression with history."""
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(AnchorTarget, Exercise.name_canonical)
            .join(Exercise, AnchorTarget.exercise_id == Exercise.id)
            .where(AnchorTarget.user_id == user_id)
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
                .where(Workout.user_id == user_id)
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
        options: list[DayOptionResponse] = []
        for template in result.scalars().all():
            if template.name in HIDDEN_SYSTEM_TEMPLATE_NAMES:
                continue

            rules = json.loads(template.rules_json)
            anchors = [a for a in rules.get("anchors", []) if isinstance(a, str) and a.strip()]
            options.append(
                DayOptionResponse(
                    name=template.name,
                    focus=template.focus,
                    exercises=anchors,
                )
            )
        return options


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

    anchors = [a for a in rules.get("anchors", []) if isinstance(a, str) and a.strip()]
    return DayOptionResponse(name=name, focus=payload.focus.strip(), exercises=anchors)


@router.get("/profile/personal")
async def get_personal_profile() -> PersonalProfileResponse:
    """Get editable personal profile fields for Profile page."""
    user_id = get_current_user_id()

    def _default_profile(weight_lbs: float | None = None) -> dict:
        return {
            "full_name": "Athlete",
            "photo_url": None,
            "age": None,
            "sex": None,
            "height_cm": None,
            "weight_unit": "lb",
            "weight_lbs": weight_lbs,
            "body_fat_pct": None,
            "primary_goal": None,
            "goal_detail": None,
            "target_weight_lbs": None,
            "timeline_weeks": None,
            "training_years": None,
            "days_per_week": None,
            "session_duration_min": None,
            "preferred_split": None,
            "preferred_short_bar_lbs": 35,
            "equipment_access": [],
            "injuries": [],
            "limitations": None,
            "exercise_likes": [],
            "exercise_dislikes": [],
            "sleep_hours": None,
            "stress_level": None,
            "activity_level": None,
            "nutrition_notes": None,
            "goal": None,
            "notes": None,
        }

    async with async_session() as session:
        personal_result = await session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.key == "athlete_personal_profile",
            )
        )
        personal = personal_result.scalar_one_or_none()

        if personal:
            data = json.loads(personal.value)
            fallback = _default_profile(weight_lbs=data.get("weight_lbs"))
            fallback.update(data)
            return PersonalProfileResponse(**fallback)

        metrics_result = await session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.key == "athlete_global_metrics",
            )
        )
        metrics = metrics_result.scalar_one_or_none()
        default_weight = None
        if metrics:
            parsed = json.loads(metrics.value)
            default_weight = parsed.get("bodyweight_end_lbs")

        return PersonalProfileResponse(**_default_profile(weight_lbs=default_weight))


@router.get("/profile/onboarding-status")
async def get_onboarding_status() -> OnboardingStatusResponse:
    """Get onboarding completion status for current user."""
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.key == "athlete_onboarding_status",
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return OnboardingStatusResponse(completed=False, completed_at=None, version=1)

        parsed = json.loads(row.value)
        return OnboardingStatusResponse(
            completed=bool(parsed.get("completed", False)),
            completed_at=parsed.get("completed_at"),
            version=int(parsed.get("version", 1)),
        )


@router.put("/profile/onboarding")
async def complete_onboarding(payload: PersonalProfileUpdateRequest) -> PersonalProfileResponse:
    """Persist onboarding profile and mark onboarding as completed."""
    profile = await update_personal_profile(payload)
    user_id = get_current_user_id()

    async with async_session() as session:
        status_result = await session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.key == "athlete_onboarding_status",
            )
        )
        status_row = status_result.scalar_one_or_none()
        status_payload = {
            "completed": True,
            "completed_at": date.today().isoformat(),
            "version": 1,
        }
        if status_row is None:
            status_row = Setting(
                user_id=user_id,
                key="athlete_onboarding_status",
                value=json.dumps(status_payload),
            )
            session.add(status_row)
        else:
            status_row.value = json.dumps(status_payload)

        await session.commit()

    return profile


@router.patch("/profile/personal")
async def update_personal_profile(payload: PersonalProfileUpdateRequest) -> PersonalProfileResponse:
    """Update editable personal profile fields."""
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.key == "athlete_personal_profile",
            )
        )
        row = result.scalar_one_or_none()

        data = json.loads(row.value) if row else {
            "full_name": "Athlete",
            "photo_url": None,
            "age": None,
            "sex": None,
            "height_cm": None,
            "weight_unit": "lb",
            "weight_lbs": None,
            "body_fat_pct": None,
            "primary_goal": None,
            "goal_detail": None,
            "target_weight_lbs": None,
            "timeline_weeks": None,
            "training_years": None,
            "days_per_week": None,
            "session_duration_min": None,
            "preferred_split": None,
            "preferred_short_bar_lbs": 35,
            "equipment_access": [],
            "injuries": [],
            "limitations": None,
            "exercise_likes": [],
            "exercise_dislikes": [],
            "sleep_hours": None,
            "stress_level": None,
            "activity_level": None,
            "nutrition_notes": None,
            "goal": None,
            "notes": None,
        }

        updates = payload.model_dump(exclude_unset=True)
        for key, value in updates.items():
            data[key] = value

        full_name = str(data.get("full_name") or "Athlete").strip() or "Athlete"
        data["full_name"] = full_name

        if row is None:
            row = Setting(user_id=user_id, key="athlete_personal_profile", value=json.dumps(data))
            session.add(row)
        else:
            row.value = json.dumps(data)

        await session.commit()

        return PersonalProfileResponse(
            full_name=data.get("full_name", "Athlete"),
            photo_url=data.get("photo_url"),
            age=data.get("age"),
            sex=data.get("sex"),
            height_cm=data.get("height_cm"),
            weight_unit=data.get("weight_unit", "lb"),
            weight_lbs=data.get("weight_lbs"),
            body_fat_pct=data.get("body_fat_pct"),
            primary_goal=data.get("primary_goal"),
            goal_detail=data.get("goal_detail"),
            target_weight_lbs=data.get("target_weight_lbs"),
            timeline_weeks=data.get("timeline_weeks"),
            training_years=data.get("training_years"),
            days_per_week=data.get("days_per_week"),
            session_duration_min=data.get("session_duration_min"),
            preferred_split=data.get("preferred_split"),
            preferred_short_bar_lbs=data.get("preferred_short_bar_lbs", 35),
            equipment_access=data.get("equipment_access") or [],
            injuries=data.get("injuries") or [],
            limitations=data.get("limitations"),
            exercise_likes=data.get("exercise_likes") or [],
            exercise_dislikes=data.get("exercise_dislikes") or [],
            sleep_hours=data.get("sleep_hours"),
            stress_level=data.get("stress_level"),
            activity_level=data.get("activity_level"),
            nutrition_notes=data.get("nutrition_notes"),
            goal=data.get("goal"),
            notes=data.get("notes"),
        )


# ─── Body Metrics ─────────────────────────────────────────────────────────────


@router.post("/body-metrics/import")
async def import_body_metrics_endpoint(payload: BodyMetricImportRequest) -> dict:
    """Import manual body metrics from JSON or CSV."""
    if payload.records and payload.csv_text:
        raise HTTPException(status_code=400, detail="Provide records or csv_text, not both")
    if not payload.records and not payload.csv_text:
        raise HTTPException(status_code=400, detail="Provide records or csv_text")

    source = payload.source.strip()
    if not source:
        raise HTTPException(status_code=400, detail="Source is required")

    records = payload.records
    if payload.csv_text:
        try:
            records = parse_csv_records(payload.csv_text)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid csv_text") from exc

    if not records:
        raise HTTPException(status_code=400, detail="No records provided")

    async with async_session() as session:
        result = await import_body_metrics(session, source=source, records=records)
        await session.commit()
        return result


@router.get("/body-metrics")
async def get_body_metrics(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    source: str | None = Query(default=None),
) -> list[BodyMetricResponse]:
    """List body metrics with optional date/source filters."""
    try:
        start = parse_date_bound(from_date, is_end=False) if from_date else None
        end = parse_date_bound(to_date, is_end=True) if to_date else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc

    if start and end and end < start:
        raise HTTPException(status_code=400, detail="Invalid date range")

    normalized_source = source.strip() if source else None

    async with async_session() as session:
        metrics = await list_body_metrics(
            session,
            source=normalized_source,
            start=start,
            end=end,
        )
        return [_body_metric_to_payload(metric) for metric in metrics]


@router.get("/body-metrics/latest")
async def get_body_metrics_latest() -> BodyMetricResponse:
    """Return the most recent body metrics entry."""
    async with async_session() as session:
        latest = await get_latest_body_metric(session)
        if not latest:
            raise HTTPException(status_code=404, detail="No body metrics found")
        return _body_metric_to_payload(latest)


@router.get("/body-metrics/summary")
async def get_body_metrics_summary_endpoint() -> BodyMetricSummaryResponse:
    """Return a summary of recent body metrics trends."""
    async with async_session() as session:
        summary = await get_body_metrics_summary(session)

    if not summary["has_data"]:
        return BodyMetricSummaryResponse(
            has_data=False,
            latest=None,
            delta_7d_weight_kg=None,
            delta_30d_weight_kg=None,
        )

    return BodyMetricSummaryResponse(
        has_data=True,
        latest=_body_metric_to_payload(summary["latest"]),
        delta_7d_weight_kg=summary["delta_7d_weight_kg"],
        delta_30d_weight_kg=summary["delta_30d_weight_kg"],
    )


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
    training_type: str = Query("all"),
) -> list[dict]:
    """Get workouts grouped by day within a date range."""
    try:
        start = date.fromisoformat(from_date)
        end = date.fromisoformat(to_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format") from exc
    if end < start:
        raise HTTPException(status_code=400, detail="Invalid date range")
    normalized_training_type = training_type.strip().lower()
    if normalized_training_type not in TRAINING_TYPE_VALUES:
        raise HTTPException(status_code=400, detail="Invalid training_type")

    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(
                Workout.id,
                Workout.date,
                Workout.template_day_name,
                Workout.training_type,
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
            .where(Workout.user_id == user_id)
            .where(WorkoutSet.set_type == "normal")
            .group_by(Workout.id)
            .order_by(Workout.date.desc())
        )

        workouts_by_date: dict[date, list[dict]] = {}
        for row in result.all():
            stored_type = (row.training_type or "").strip().lower()
            detected_type = (
                stored_type
                if stored_type in ROUTINE_TRAINING_TYPE_VALUES
                else _classify_training_type(row.template_day_name)
            )
            if normalized_training_type != "all" and detected_type != normalized_training_type:
                continue
            workouts_by_date.setdefault(row.date, []).append({
                "id": row.id,
                "date": row.date.isoformat(),
                "day_name": row.template_day_name,
                "training_type": detected_type,
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


@router.get("/history/weekly-compare")
async def get_weekly_compare(
    ref: str | None = Query(None),
    training_type: str = Query("all"),
) -> dict:
    normalized_training_type = training_type.strip().lower()
    if normalized_training_type not in TRAINING_TYPE_VALUES:
        raise HTTPException(status_code=400, detail="Invalid training_type")

    reference_date = date.today()
    if ref:
        try:
            reference_date = date.fromisoformat(ref)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid ref date") from exc

    current_start = reference_date - timedelta(days=reference_date.weekday())
    current_end = current_start + timedelta(days=6)
    previous_start = current_start - timedelta(days=7)
    previous_end = current_start - timedelta(days=1)

    async with async_session() as session:
        current = await _aggregate_week_window(
            session=session,
            start=current_start,
            end=current_end,
            training_type=normalized_training_type,
        )
        previous = await _aggregate_week_window(
            session=session,
            start=previous_start,
            end=previous_end,
            training_type=normalized_training_type,
        )

    delta = {
        "sessions": current["sessions"] - previous["sessions"],
        "sets": current["sets"] - previous["sets"],
        "volume": round(current["volume"] - previous["volume"], 2),
    }
    delta_pct = {
        "sessions": _compute_delta_pct(current["sessions"], previous["sessions"]),
        "sets": _compute_delta_pct(current["sets"], previous["sets"]),
        "volume": _compute_delta_pct(current["volume"], previous["volume"]),
    }

    return {
        "reference_date": reference_date.isoformat(),
        "training_type": normalized_training_type,
        "current_week": {
            "from": current_start.isoformat(),
            "to": current_end.isoformat(),
            **current,
        },
        "previous_week": {
            "from": previous_start.isoformat(),
            "to": previous_end.isoformat(),
            **previous,
        },
        "delta": delta,
        "delta_pct": delta_pct,
    }


@router.post("/history/backfill-training-type")
async def backfill_history_training_type() -> dict:
    """Backfill workouts.training_type from routines and day name heuristics."""
    from src.services.history_backfill import backfill_workout_training_types

    user_id = get_current_user_id()
    async with async_session() as session:
        result = await backfill_workout_training_types(session, user_id=user_id)
        await session.commit()
        return result


@router.get("/history/training-type-stats")
async def history_training_type_stats() -> dict:
    """Return all-time workout counts grouped by effective training_type."""
    user_id = get_current_user_id()
    async with async_session() as session:
        result = await session.execute(
            select(Workout.template_day_name, Workout.training_type)
            .where(Workout.user_id == user_id)
        )

    counts = {"push": 0, "pull": 0, "legs": 0, "custom": 0}
    inferred = 0
    total = 0

    for row in result.all():
        total += 1
        stored_type = (row.training_type or "").strip().lower()
        if stored_type in ROUTINE_TRAINING_TYPE_VALUES:
            effective = stored_type
        else:
            effective = _classify_training_type(row.template_day_name)
            inferred += 1
        counts[effective] += 1

    return {
        "total": total,
        "push": counts["push"],
        "pull": counts["pull"],
        "legs": counts["legs"],
        "custom": counts["custom"],
        "non_custom": counts["push"] + counts["pull"] + counts["legs"],
        "inferred": inferred,
    }


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


# --- Routines ---


def _clean_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _to_template_name(name: str, routine_id: int) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_ ]+", "", name.strip())
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = normalized[:50]
    return normalized or f"Routine_{routine_id}"


def _routine_to_detail_payload(routine: Routine) -> dict:
    sorted_exercises = sorted(routine.exercises, key=lambda ex: ex.sort_order)
    exercise_payload = []
    for routine_exercise in sorted_exercises:
        sorted_sets = sorted(routine_exercise.sets, key=lambda s: s.set_index)
        exercise_payload.append(
            {
                "id": routine_exercise.id,
                "name": routine_exercise.display_name,
                "exercise_id": routine_exercise.exercise_id,
                "rest_seconds": routine_exercise.rest_seconds,
                "notes": routine_exercise.notes,
                "primary_muscle": routine_exercise.exercise.primary_muscle
                if routine_exercise.exercise
                else "unknown",
                "is_anchor": routine_exercise.exercise.is_anchor if routine_exercise.exercise else False,
                "sets": [
                    {
                        "id": routine_set.id,
                        "set_index": routine_set.set_index,
                        "set_type": routine_set.set_type,
                        "target_weight_lbs": routine_set.target_weight_lbs,
                        "target_reps": routine_set.target_reps,
                        "rir_target": routine_set.rir_target,
                    }
                    for routine_set in sorted_sets
                ],
            }
        )

    total_sets = sum(len(ex["sets"]) for ex in exercise_payload)
    muscles = sorted({ex["primary_muscle"] for ex in exercise_payload if ex["primary_muscle"] != "unknown"})

    return {
        "id": routine.id,
        "folder_id": routine.folder_id,
        "name": routine.name,
        "subtitle": routine.subtitle,
        "notes": routine.notes,
        "training_type": routine.training_type,
        "sort_order": routine.sort_order,
        "exercise_count": len(exercise_payload),
        "total_sets": total_sets,
        "muscles": muscles,
        "exercises": exercise_payload,
    }


async def _fetch_routine_or_404(session, routine_id: int) -> Routine:
    user_id = get_current_user_id()
    result = await session.execute(
        select(Routine)
        .options(
            selectinload(Routine.exercises).selectinload(RoutineExercise.sets),
            selectinload(Routine.exercises).selectinload(RoutineExercise.exercise),
        )
        .where(
            Routine.id == routine_id,
            Routine.user_id == user_id,
            Routine.is_deleted.is_(False),
        )
    )
    routine = result.scalar_one_or_none()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


async def _upsert_routine_exercises(session, routine: Routine, exercises: list[RoutineExerciseInput]) -> None:
    for ex in list(routine.exercises):
        await session.delete(ex)
    await session.flush()

    for ex_idx, ex in enumerate(exercises):
        ex_name = _clean_name(ex.name)
        if not ex_name:
            continue

        linked_exercise = None
        if ex.exercise_id is not None:
            linked_exercise = await session.get(Exercise, ex.exercise_id)
        if linked_exercise is None:
            lookup = await session.execute(
                select(Exercise)
                .where(func.lower(Exercise.name_canonical) == ex_name.lower())
                .limit(1)
            )
            linked_exercise = lookup.scalar_one_or_none()

        routine_exercise = RoutineExercise(
            routine_id=routine.id,
            exercise_id=linked_exercise.id if linked_exercise else None,
            display_name=ex_name,
            sort_order=ex_idx,
            rest_seconds=ex.rest_seconds,
            notes=ex.notes,
        )
        session.add(routine_exercise)
        await session.flush()

        for set_idx, set_payload in enumerate(ex.sets):
            session.add(
                RoutineSet(
                    routine_exercise_id=routine_exercise.id,
                    set_index=set_idx,
                    set_type=set_payload.set_type,
                    target_weight_lbs=set_payload.target_weight_lbs,
                    target_reps=set_payload.target_reps,
                    rir_target=set_payload.rir_target,
                )
            )


@router.get("/routines/folders")
async def list_routine_folders() -> list[dict]:
    """List non-deleted routine folders with active routine counts."""
    user_id = get_current_user_id()
    async with async_session() as session:
        folders_result = await session.execute(
            select(RoutineFolder)
            .where(RoutineFolder.user_id == user_id, RoutineFolder.is_deleted.is_(False))
            .order_by(RoutineFolder.sort_order, RoutineFolder.id)
        )

        folders = []
        for folder in folders_result.scalars().all():
            count_result = await session.execute(
                select(func.count())
                .select_from(Routine)
                .where(
                    Routine.user_id == user_id,
                    Routine.folder_id == folder.id,
                    Routine.is_deleted.is_(False),
                )
            )
            folders.append(
                {
                    "id": folder.id,
                    "name": folder.name,
                    "sort_order": folder.sort_order,
                    "routine_count": int(count_result.scalar_one() or 0),
                }
            )
        return folders


@router.post("/routines/folders")
async def create_routine_folder(payload: RoutineFolderCreateRequest) -> dict:
    """Create a routine folder."""
    name = _clean_name(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    user_id = get_current_user_id()
    async with async_session() as session:
        existing = await session.execute(
            select(RoutineFolder).where(
                RoutineFolder.user_id == user_id,
                func.lower(RoutineFolder.name) == name.lower(),
                RoutineFolder.is_deleted.is_(False),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Folder already exists")

        max_sort_result = await session.execute(select(func.max(RoutineFolder.sort_order)))
        sort_order = int(max_sort_result.scalar_one() or 0) + 1

        folder = RoutineFolder(user_id=user_id, name=name, sort_order=sort_order, is_deleted=False)
        session.add(folder)
        await session.commit()
        await session.refresh(folder)
        return {"id": folder.id, "name": folder.name, "sort_order": folder.sort_order, "routine_count": 0}


@router.patch("/routines/folders/{folder_id}")
async def update_routine_folder(folder_id: int, payload: RoutineFolderUpdateRequest) -> dict:
    """Update routine folder metadata."""
    user_id = get_current_user_id()
    async with async_session() as session:
        folder = await session.get(RoutineFolder, folder_id)
        if not folder or folder.user_id != user_id or folder.is_deleted:
            raise HTTPException(status_code=404, detail="Folder not found")

        if payload.name is not None:
            name = _clean_name(payload.name)
            if not name:
                raise HTTPException(status_code=400, detail="Folder name is required")
            folder.name = name
        if payload.sort_order is not None:
            folder.sort_order = payload.sort_order

        await session.commit()

        count_result = await session.execute(
            select(func.count())
            .select_from(Routine)
            .where(
                Routine.user_id == user_id,
                Routine.folder_id == folder.id,
                Routine.is_deleted.is_(False),
            )
        )
        return {
            "id": folder.id,
            "name": folder.name,
            "sort_order": folder.sort_order,
            "routine_count": int(count_result.scalar_one() or 0),
        }


@router.delete("/routines/folders/{folder_id}")
async def delete_routine_folder(folder_id: int) -> dict:
    """Soft-delete a folder and all routines inside it."""
    user_id = get_current_user_id()
    async with async_session() as session:
        folder = await session.get(RoutineFolder, folder_id)
        if not folder or folder.user_id != user_id or folder.is_deleted:
            raise HTTPException(status_code=404, detail="Folder not found")

        folder.is_deleted = True
        routines_result = await session.execute(
            select(Routine).where(Routine.user_id == user_id, Routine.folder_id == folder_id)
        )
        for routine in routines_result.scalars().all():
            routine.is_deleted = True

        await session.commit()
        return {"removed": folder_id}


@router.get("/routines")
async def list_routines(folder_id: int | None = None) -> list[dict]:
    """List non-deleted routines with card preview data."""
    user_id = get_current_user_id()
    async with async_session() as session:
        query = select(Routine).where(Routine.user_id == user_id, Routine.is_deleted.is_(False))
        if folder_id is not None:
            query = query.where(Routine.folder_id == folder_id)

        routines_result = await session.execute(query.order_by(Routine.sort_order, Routine.id))
        routines = routines_result.scalars().all()

        cards: list[dict] = []
        for routine in routines:
            ex_result = await session.execute(
                select(RoutineExercise)
                .where(RoutineExercise.routine_id == routine.id)
                .order_by(RoutineExercise.sort_order, RoutineExercise.id)
            )
            exercises = ex_result.scalars().all()
            total_sets = 0
            preview_items: list[dict] = []
            for ex in exercises:
                set_count_result = await session.execute(
                    select(func.count())
                    .select_from(RoutineSet)
                    .where(RoutineSet.routine_exercise_id == ex.id)
                )
                set_count = int(set_count_result.scalar_one() or 0)
                total_sets += set_count
                if len(preview_items) < 3:
                    preview_items.append({"name": ex.display_name, "set_count": set_count})

            cards.append(
                {
                    "id": routine.id,
                    "folder_id": routine.folder_id,
                    "name": routine.name,
                    "subtitle": routine.subtitle,
                    "notes": routine.notes,
                    "training_type": routine.training_type,
                    "sort_order": routine.sort_order,
                    "exercise_count": len(exercises),
                    "total_sets": total_sets,
                    "preview_exercises": [ex.display_name for ex in exercises[:3]],
                    "preview_items": preview_items,
                    "remaining_exercises": max(0, len(exercises) - len(preview_items)),
                }
            )
        return cards


@router.post("/routines")
async def create_routine(payload: RoutineCreateRequest) -> dict:
    """Create a routine with ordered exercises and sets."""
    name = _clean_name(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="Routine name is required")

    user_id = get_current_user_id()
    async with async_session() as session:
        folder = await session.get(RoutineFolder, payload.folder_id)
        if not folder or folder.user_id != user_id or folder.is_deleted:
            raise HTTPException(status_code=404, detail="Folder not found")

        if payload.sort_order is not None:
            sort_order = payload.sort_order
        else:
            max_sort_result = await session.execute(
                select(func.max(Routine.sort_order)).where(Routine.folder_id == payload.folder_id)
            )
            sort_order = int(max_sort_result.scalar_one() or 0) + 1

        routine = Routine(
            user_id=user_id,
            folder_id=payload.folder_id,
            name=name,
            subtitle=payload.subtitle,
            notes=payload.notes,
            training_type=payload.training_type,
            sort_order=sort_order,
            is_deleted=False,
        )
        session.add(routine)
        await session.flush()

        await _upsert_routine_exercises(session, routine, payload.exercises)
        await session.commit()

        routine_full = await _fetch_routine_or_404(session, routine.id)
        return _routine_to_detail_payload(routine_full)


@router.get("/routines/{routine_id}")
async def get_routine(routine_id: int) -> dict:
    """Get detailed routine including all exercises and sets."""
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)
        return _routine_to_detail_payload(routine)


@router.patch("/routines/{routine_id}")
async def update_routine(routine_id: int, payload: RoutineUpdateRequest) -> dict:
    """Update routine metadata and optionally replace exercise structure."""
    user_id = get_current_user_id()
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)

        if payload.folder_id is not None:
            folder = await session.get(RoutineFolder, payload.folder_id)
            if not folder or folder.user_id != user_id or folder.is_deleted:
                raise HTTPException(status_code=404, detail="Folder not found")
            routine.folder_id = payload.folder_id
        if payload.name is not None:
            name = _clean_name(payload.name)
            if not name:
                raise HTTPException(status_code=400, detail="Routine name is required")
            routine.name = name
        if payload.subtitle is not None:
            routine.subtitle = payload.subtitle
        if payload.notes is not None:
            routine.notes = payload.notes
        if payload.training_type is not None:
            routine.training_type = payload.training_type
        if payload.sort_order is not None:
            routine.sort_order = payload.sort_order

        if payload.exercises is not None:
            await _upsert_routine_exercises(session, routine, payload.exercises)

        await session.commit()
        routine = await _fetch_routine_or_404(session, routine_id)
        return _routine_to_detail_payload(routine)


@router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: int) -> dict:
    """Soft-delete a routine."""
    user_id = get_current_user_id()
    async with async_session() as session:
        routine = await session.get(Routine, routine_id)
        if not routine or routine.user_id != user_id or routine.is_deleted:
            raise HTTPException(status_code=404, detail="Routine not found")

        routine.is_deleted = True
        await session.commit()
        return {"removed": routine_id}


@router.post("/routines/{routine_id}/duplicate")
async def duplicate_routine(routine_id: int) -> dict:
    """Duplicate an existing routine in the same folder."""
    user_id = get_current_user_id()
    async with async_session() as session:
        source = await _fetch_routine_or_404(session, routine_id)

        max_sort_result = await session.execute(
            select(func.max(Routine.sort_order)).where(
                Routine.user_id == user_id,
                Routine.folder_id == source.folder_id,
            )
        )
        sort_order = int(max_sort_result.scalar_one() or 0) + 1

        clone = Routine(
            user_id=user_id,
            folder_id=source.folder_id,
            name=f"{source.name} Copy",
            subtitle=source.subtitle,
            notes=source.notes,
            training_type=source.training_type,
            sort_order=sort_order,
            is_deleted=False,
        )
        session.add(clone)
        await session.flush()

        for ex in sorted(source.exercises, key=lambda item: item.sort_order):
            clone_ex = RoutineExercise(
                routine_id=clone.id,
                exercise_id=ex.exercise_id,
                display_name=ex.display_name,
                sort_order=ex.sort_order,
                rest_seconds=ex.rest_seconds,
                notes=ex.notes,
            )
            session.add(clone_ex)
            await session.flush()

            for set_row in sorted(ex.sets, key=lambda row: row.set_index):
                session.add(
                    RoutineSet(
                        routine_exercise_id=clone_ex.id,
                        set_index=set_row.set_index,
                        set_type=set_row.set_type,
                        target_weight_lbs=set_row.target_weight_lbs,
                        target_reps=set_row.target_reps,
                        rir_target=set_row.rir_target,
                    )
                )

        await session.commit()
        clone = await _fetch_routine_or_404(session, clone.id)
        return _routine_to_detail_payload(clone)


@router.post("/routines/{routine_id}/share")
async def share_routine(routine_id: int) -> dict:
    """Return JSON payload to share/export a routine."""
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)
        payload = _routine_to_detail_payload(routine)
        return {
            "version": 1,
            "exported_at": date.today().isoformat(),
            "routine": payload,
        }


@router.post("/routines/{routine_id}/start")
async def start_routine(routine_id: int) -> dict:
    """Convert a saved routine into today's active plan and persist it."""

    def to_today_set_type(value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized == "warmup":
            return "warmup"
        if normalized in {"approach", "working", "normal"}:
            return "normal"
        if normalized == "drop":
            return "drop"
        return "normal"

    user_id = get_current_user_id()
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)
        if not routine.exercises:
            raise HTTPException(status_code=400, detail="Routine has no exercises")

        total_sets = 0
        total_volume = 0.0
        estimated_minutes = 0.0
        exercises_payload = []

        for ex in sorted(routine.exercises, key=lambda item: item.sort_order):
            rest_seconds = ex.rest_seconds or 90
            sets_payload = []
            for set_row in sorted(ex.sets, key=lambda row: row.set_index):
                total_sets += 1
                if set_row.target_weight_lbs is not None and set_row.target_reps is not None:
                    total_volume += set_row.target_weight_lbs * set_row.target_reps
                estimated_minutes += 0.6 + (rest_seconds / 60)

                sets_payload.append(
                    {
                        "set_type": to_today_set_type(set_row.set_type),
                        "weight_lbs": set_row.target_weight_lbs,
                        "target_reps": set_row.target_reps,
                        "rir_target": set_row.rir_target,
                        "rest_seconds": rest_seconds,
                    }
                )

            exercises_payload.append(
                {
                    "name": ex.display_name,
                    "is_anchor": ex.exercise.is_anchor if ex.exercise else False,
                    "notes": ex.notes or "",
                    "sets": sets_payload,
                }
            )

        plan_json = {
            "day_name": routine.name,
            "training_type": routine.training_type,
            "estimated_duration_min": int(max(15, round(estimated_minutes))),
            "exercises": exercises_payload,
            "total_sets": total_sets,
            "estimated_volume_lbs": round(total_volume, 2),
            "note": routine.subtitle or "",
        }

        plan = Plan(
            user_id=user_id,
            start_date=date.today(),
            end_date=date.today(),
            goal=f"Routine start: {routine.name}",
            days_per_week=1,
        )
        session.add(plan)
        await session.flush()

        plan_day = PlanDay(
            plan_id=plan.id,
            date=date.today(),
            template_day_name=_to_template_name(routine.name, routine.id),
            content_json=json.dumps(plan_json),
            validation_json=None,
        )
        session.add(plan_day)
        await session.commit()

        return {"routine_id": routine.id, "plan_day_id": plan_day.id, "plan": plan_json}


@router.get("/routines/{routine_id}/progression-preview")
async def routine_progression_preview(
    routine_id: int,
    lookback: int = Query(default=5, ge=3, le=8),
) -> dict:
    """Preview anchor progression suggestions for a specific saved routine."""
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)
        preview = await build_routine_progression_preview(session, routine, lookback=lookback)
        return {
            "routine_id": routine.id,
            "routine_name": routine.name,
            "lookback": lookback,
            "anchors": preview,
        }


@router.post("/routines/{routine_id}/progression-apply")
async def routine_progression_apply(
    routine_id: int,
    lookback: int = Query(default=5, ge=3, le=8),
) -> dict:
    """Apply progression suggestions directly into routine working sets."""
    async with async_session() as session:
        routine = await _fetch_routine_or_404(session, routine_id)
        apply_result = await apply_routine_progression(session, routine, lookback=lookback)
        await session.commit()
        updated = await _fetch_routine_or_404(session, routine_id)
        return {
            "routine_id": routine.id,
            "routine_name": routine.name,
            "lookback": lookback,
            "updated_exercises": apply_result["updated_exercises"],
            "updated_sets": apply_result["updated_sets"],
            "added_sets": apply_result["added_sets"],
            "anchors": apply_result["preview"],
            "routine": _routine_to_detail_payload(updated),
        }


# ─── Complete Session (advance day + fatigue) ─────────────────────────────────


class CompleteSessionRequest(StrictRequestModel):
    workout_id: int = Field(ge=1)
    fatigue: float = Field(ge=1, le=10)
    duration_min: int | None = Field(default=None, ge=1, le=600)


@router.post("/today/complete")
async def complete_today_session(payload: CompleteSessionRequest) -> dict:
    """
    Mark today's session as complete, save fatigue rating, and advance the day index.
    Mirrors what /done did in the Telegram bot.
    """
    from src.models.feedback import SessionFeedback

    user_id = get_current_user_id()
    async with async_session() as session:
        # Verify workout exists
        workout = await session.get(Workout, payload.workout_id)
        if not workout or workout.user_id != user_id:
            raise HTTPException(status_code=404, detail="Workout not found")

        if payload.duration_min is not None:
            workout.duration_min = payload.duration_min
            session.add(workout)

        # Save fatigue feedback
        feedback = await session.get(SessionFeedback, payload.workout_id)
        if feedback is None:
            feedback = SessionFeedback(
                workout_id=payload.workout_id,
                fatigue=payload.fatigue,
            )
        else:
            feedback.fatigue = payload.fatigue
        session.add(feedback)

        # Advance athlete state
        state_result = await session.execute(
            select(AthleteState).where(AthleteState.user_id == user_id)
        )
        state = state_result.scalar_one_or_none()
        if state is None:
            state = AthleteState(
                user_id=user_id,
                next_day_index=2,
                fatigue_score=round(payload.fatigue, 1),
            )
            session.add(state)
        else:
            state.next_day_index = (state.next_day_index % 6) + 1
            state.fatigue_score = round(state.fatigue_score * 0.7 + payload.fatigue * 0.3, 1)
            session.add(state)

        await session.commit()

        streak_result = await session.execute(
            select(Workout.date)
            .where(Workout.user_id == user_id)
            .distinct()
            .order_by(desc(Workout.date))
            .limit(400)
        )
        streak_dates = [row[0] for row in streak_result.all()]

        streak_days = 0
        if streak_dates:
            streak_days = 1
            cursor = streak_dates[0]
            for d in streak_dates[1:]:
                if d == cursor - timedelta(days=1):
                    streak_days += 1
                    cursor = d
                    continue
                break

        return {
            "workout_id": payload.workout_id,
            "next_day_index": state.next_day_index if state else 1,
            "fatigue_saved": payload.fatigue,
            "streak_days": streak_days,
        }


# ─── Week Plan ────────────────────────────────────────────────────────────────


@router.get("/week")
async def get_week_plan() -> list[dict]:
    """
    Return a 6-day plan. Each day is served from PlanDay cache if available,
    otherwise returns the week template metadata for that day.
    """
    user_id = get_current_user_id()
    async with async_session() as session:
        templates_result = await session.execute(
            select(WeekTemplate)
            .where(WeekTemplate.day_index <= 6)
            .order_by(WeekTemplate.day_index)
        )
        templates = templates_result.scalars().all()

        # Get the last generated plan per day_name from PlanDay cache
        plans_result = await session.execute(
            select(PlanDay)
            .join(Plan, PlanDay.plan_id == Plan.id)
            .where(Plan.user_id == user_id)
            .order_by(desc(PlanDay.id))
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
async def get_exercise_alternatives(
    exercise_name: str,
    limit: int = Query(default=5, ge=1, le=20),
) -> list[dict]:
    """Find swap candidates for a given exercise name."""
    from src.services.swap_service import find_swap_candidates

    normalized_exercise_name = exercise_name.strip()
    if not normalized_exercise_name:
        raise HTTPException(status_code=400, detail="Exercise name is required")
    if len(normalized_exercise_name) > 120:
        raise HTTPException(status_code=400, detail="Exercise name too long")

    async with async_session() as session:
        # Find exercise by name
        result = await session.execute(
            select(Exercise).where(Exercise.name_canonical.ilike(normalized_exercise_name)).limit(1)
        )
        exercise = result.scalar_one_or_none()
        if not exercise:
            raise HTTPException(status_code=404, detail=f"Exercise '{exercise_name}' not found")

        candidates = await find_swap_candidates(session, exercise.id, limit=limit)
        return candidates


# ─── Protection Manager ────────────────────────────────────────────────────────


class ProtectionRequest(StrictRequestModel):
    muscle_group: str = Field(min_length=1, max_length=50)
    severity: int = Field(default=5, ge=1, le=10)


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
