"""Training day recommendation service."""

from __future__ import annotations

import json
from datetime import date

from sqlalchemy import desc, select

from src.models.settings import WeekTemplate
from src.models.workouts import Workout


MUSCLE_CATEGORY_MAP: dict[str, str] = {
    "chest": "pecho",
    "lats": "espalda",
    "upper_back": "espalda",
    "biceps": "biceps",
    "triceps": "tricep",
    "front_delts": "hombro",
    "side_delts": "hombro",
    "rear_delts": "hombro",
    "quads": "cuadriceps",
    "hamstrings": "femorales",
    "glutes": "gluteos",
    "calves": "pantorrilla",
    "core": "core",
}

FALLBACK_DAY_CATEGORIES: dict[str, list[str]] = {
    "Push_Heavy": ["pecho", "hombro", "tricep"],
    "Pull_Heavy": ["espalda", "biceps"],
    "Quads_Heavy": ["cuadriceps"],
    "Upper_Complement": ["pecho", "espalda"],
    "Arms_Shoulders": ["brazos", "hombro"],
    "Posterior_Heavy": ["femorales", "gluteos"],
    "Pecho_Hombro_Tricep": ["pecho", "hombro", "tricep"],
    "Espalda_Biceps": ["espalda", "biceps"],
    "Cuadriceps": ["cuadriceps"],
    "Femorales_Nalga": ["femorales", "gluteos"],
    "Pierna": ["cuadriceps", "femorales", "gluteos"],
    "Brazo": ["brazos", "hombro"],
    "Pecho_Espalda": ["pecho", "espalda"],
}


def _categories_from_rules(rules_json: str) -> list[str]:
    try:
        rules = json.loads(rules_json)
    except json.JSONDecodeError:
        return []

    primary_muscles = rules.get("primary_muscles", [])
    categories = []
    for muscle in primary_muscles:
        label = MUSCLE_CATEGORY_MAP.get(muscle)
        if label and label not in categories:
            categories.append(label)
    return categories


def _template_categories(template: WeekTemplate) -> list[str]:
    categories = _categories_from_rules(template.rules_json)
    if categories:
        return categories
    return FALLBACK_DAY_CATEGORIES.get(template.name, [])


async def suggest_day(session) -> dict:
    """Return a recommended day_name with a brief reason."""
    templates_result = await session.execute(select(WeekTemplate).order_by(WeekTemplate.day_index))
    templates = templates_result.scalars().all()

    workouts_result = await session.execute(
        select(Workout).order_by(desc(Workout.date)).limit(30)
    )
    workouts = workouts_result.scalars().all()

    last_workout = workouts[0] if workouts else None
    last_template = None
    if last_workout and last_workout.template_day_name:
        last_template = next(
            (t for t in templates if t.name == last_workout.template_day_name),
            None,
        )
    last_categories = set(_template_categories(last_template)) if last_template else set()

    last_seen: dict[str, int] = {}
    today = date.today()

    for w in workouts:
        if not w.template_day_name:
            continue
        template = next((t for t in templates if t.name == w.template_day_name), None)
        if template is None:
            continue
        categories = _template_categories(template)
        if not categories:
            continue
        days_ago = (today - w.date).days
        for category in categories:
            prev = last_seen.get(category)
            if prev is None or days_ago < prev:
                last_seen[category] = days_ago

    best_template = None
    best_score = -999
    best_reason = ""

    for template in templates:
        categories = _template_categories(template)
        if not categories:
            continue

        days_list: list[int] = [last_seen[cat] for cat in categories if cat in last_seen]
        if not days_list:
            score = 30
            reason = f"No hay historial reciente para {categories[0]}"
        else:
            max_days = max(days_list)
            score = max_days
            reason = f"No entrenas {categories[0]} desde hace {max_days} dias"

        if last_categories & set(categories):
            score -= 2

        if last_workout and last_workout.date and (today - last_workout.date).days <= 2:
            if last_workout.template_day_name == template.name:
                score -= 4
            elif last_categories & set(categories):
                score -= 2

        if last_workout and last_workout.template_day_name:
            last_name = last_workout.template_day_name
            if last_name.endswith("Heavy") and template.name.endswith("Heavy"):
                if last_categories & set(categories):
                    score -= 1

        if best_template is None or score > best_score or (
            score == best_score and template.day_index < best_template.day_index
        ):
            best_score = score
            best_template = template
            best_reason = reason

    if best_template is None:
        return {
            "day_name": "",
            "reason": "No hay templates disponibles",
        }

    return {
        "day_name": best_template.name,
        "reason": best_reason,
    }
