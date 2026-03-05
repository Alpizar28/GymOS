"""Bootstrap default routines from custom week templates."""

import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.exercises import Exercise
from src.models.routines import Routine, RoutineExercise, RoutineFolder, RoutineSet
from src.models.settings import WeekTemplate

HIDDEN_SYSTEM_TEMPLATE_NAMES = {
    "Push_Heavy",
    "Pull_Heavy",
    "Quads_Heavy",
    "Upper_Complement",
    "Arms_Shoulders",
    "Posterior_Heavy",
}


def _display_name(template_name: str) -> str:
    return template_name.replace("_", " ").strip()


def _infer_training_type(name: str, focus: str | None) -> str:
    text = f"{name} {focus or ''}".lower()
    if "push" in text:
        return "push"
    if "pull" in text:
        return "pull"
    if "leg" in text or "quad" in text or "posterior" in text:
        return "legs"
    return "custom"


async def ensure_default_routines(session: AsyncSession) -> int:
    """Create initial routines from non-system templates once."""
    count_result = await session.execute(
        select(func.count()).select_from(Routine).where(Routine.is_deleted.is_(False))
    )
    if count_result.scalar_one() > 0:
        return 0

    folder = RoutineFolder(name="Rutinas", sort_order=0, is_deleted=False)
    session.add(folder)
    await session.flush()

    templates_result = await session.execute(select(WeekTemplate).order_by(WeekTemplate.day_index))
    templates = templates_result.scalars().all()

    created = 0
    for template in templates:
        if template.name in HIDDEN_SYSTEM_TEMPLATE_NAMES:
            continue

        rules = json.loads(template.rules_json)
        anchor_names = [a for a in rules.get("anchors", []) if isinstance(a, str) and a.strip()]

        routine = Routine(
            folder_id=folder.id,
            name=_display_name(template.name),
            subtitle=template.focus,
            notes=f"Imported from template: {template.name}",
            training_type=_infer_training_type(template.name, template.focus),
            sort_order=created,
            is_deleted=False,
        )
        session.add(routine)
        await session.flush()

        for ex_idx, ex_name in enumerate(anchor_names):
            ex_result = await session.execute(
                select(Exercise).where(func.lower(Exercise.name_canonical) == ex_name.lower()).limit(1)
            )
            exercise = ex_result.scalar_one_or_none()

            routine_exercise = RoutineExercise(
                routine_id=routine.id,
                exercise_id=exercise.id if exercise else None,
                display_name=ex_name,
                sort_order=ex_idx,
                rest_seconds=90,
                notes=None,
            )
            session.add(routine_exercise)
            await session.flush()

            sets = [
                RoutineSet(
                    routine_exercise_id=routine_exercise.id,
                    set_index=0,
                    set_type="warmup",
                    target_weight_lbs=None,
                    target_reps=10,
                    rir_target=4,
                ),
                RoutineSet(
                    routine_exercise_id=routine_exercise.id,
                    set_index=1,
                    set_type="normal",
                    target_weight_lbs=None,
                    target_reps=8,
                    rir_target=2,
                ),
                RoutineSet(
                    routine_exercise_id=routine_exercise.id,
                    set_index=2,
                    set_type="normal",
                    target_weight_lbs=None,
                    target_reps=8,
                    rir_target=2,
                ),
            ]
            session.add_all(sets)

        created += 1

    return created
