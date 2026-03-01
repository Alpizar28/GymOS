#!/usr/bin/env python3
"""
Training Data Analyzer
Parses jose_alpizar_structured.txt and generates:
  1. ATHLETE_PROFILE
  2. EXERCISE_LIBRARY
  3. PROGRAM_CONSTRAINTS
"""

import re
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import Any

# ─── PARSING ─────────────────────────────────────────────────────────────

def parse_structured_file(filepath: str) -> list[dict]:
    """Parse the YAML-like structured training file into a list of session dicts."""
    sessions: list[dict] = []
    current_session: dict | None = None
    current_exercise: dict | None = None

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.rstrip()
            if not stripped:
                continue

            if stripped == "SESSION:":
                if current_exercise and current_session:
                    current_session["exercises"].append(current_exercise)
                if current_session:
                    sessions.append(current_session)
                current_session = {"exercises": []}
                current_exercise = None
                continue

            if current_session is None:
                continue

            # Session-level fields
            m = re.match(r"\s+date:\s+(.+)", stripped)
            if m:
                current_session["date"] = m.group(1).strip()
                continue

            m = re.match(r"\s+duration_minutes:\s+(.+)", stripped)
            if m:
                try:
                    current_session["duration_minutes"] = float(m.group(1))
                except ValueError:
                    current_session["duration_minutes"] = 0.0
                continue

            m = re.match(r"\s+bodyweight_lbs:\s+(.+)", stripped)
            if m:
                try:
                    current_session["bodyweight_lbs"] = float(m.group(1))
                except ValueError:
                    current_session["bodyweight_lbs"] = 0.0
                continue

            m = re.match(r"\s+total_session_volume_lbs:\s+(.+)", stripped)
            if m:
                try:
                    current_session["total_session_volume_lbs"] = float(m.group(1))
                except ValueError:
                    current_session["total_session_volume_lbs"] = 0.0
                continue

            if stripped.strip() == "EXERCISES:":
                continue

            # Exercise name
            m = re.match(r"\s+- name:\s+(.+)", stripped)
            if m:
                if current_exercise:
                    current_session["exercises"].append(current_exercise)
                current_exercise = {
                    "name": m.group(1).strip(),
                    "total_volume_lbs": 0.0,
                    "sets": []
                }
                continue

            # Exercise volume
            m = re.match(r"\s+total_volume_lbs:\s+(.+)", stripped)
            if m and current_exercise:
                val = m.group(1).strip()
                current_exercise["total_volume_lbs"] = 0.0 if val == "null" else float(val)
                continue

            if stripped.strip() == "sets:":
                continue

            # Set data
            m = re.match(r"\s+- \{weight:\s*([^,]+),\s*reps:\s*([^,]+),\s*type:\s*([^}]+)\}", stripped)
            if m and current_exercise:
                current_exercise["sets"].append({
                    "weight": float(m.group(1)),
                    "reps": int(m.group(2)),
                    "type": m.group(3).strip()
                })
                continue

    # Flush last session/exercise
    if current_exercise and current_session:
        current_session["exercises"].append(current_exercise)
    if current_session:
        sessions.append(current_session)

    return sessions


# ─── EXERCISE TAXONOMY ───────────────────────────────────────────────────

# Canonical name mapping (merge variations)
CANONICAL_NAMES: dict[str, str] = {
    "pull over": "Pullover Machine",
    "pullover sentado espalda": "Pullover Machine",
    "dumbbell pullover": "Dumbbell Pullover",
    "low chest machine": "Low Chest Machine",
    "push ups": "Push Ups",
    "pull ups": "Pull Ups",
    "chin ups": "Chin Ups",
    "double crunches": "Double Crunches",
    "crunches": "Crunches",
    "plank": "Plank",
    "dead hang": "Dead Hang",
    "face pull": "Face Pull",
}

# Exercise metadata: (primary_muscle, secondary_muscles, type, movement_pattern)
EXERCISE_META: dict[str, tuple[str, list[str], str, str]] = {
    # PUSH — Chest
    "Incline Bench Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Bench Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Smith Machine Incline Bench Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Incline Dumbbell Bench Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Dumbbell Bench Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Chest Press": ("chest", ["front_delts", "triceps"], "compound", "horizontal_push"),
    "Machine Chest Fly": ("chest", [], "isolation", "horizontal_push"),
    "Low to High Cable Fly": ("chest", ["front_delts"], "isolation", "horizontal_push"),
    "Cable Fly": ("chest", [], "isolation", "horizontal_push"),
    "Low Chest Machine": ("chest", [], "isolation", "horizontal_push"),

    # PUSH — Shoulders
    "Dumbbell Lateral Raise": ("side_delts", [], "isolation", "lateral_raise"),
    "Cable Lateral Raise": ("side_delts", [], "isolation", "lateral_raise"),
    "Machine Lateral Raise": ("side_delts", [], "isolation", "lateral_raise"),
    "Dumbbell Shoulder Press": ("front_delts", ["side_delts", "triceps"], "compound", "vertical_push"),
    "Smith Machine Shoulder Press": ("front_delts", ["side_delts", "triceps"], "compound", "vertical_push"),
    "Machine Shoulder Press": ("front_delts", ["side_delts", "triceps"], "compound", "vertical_push"),
    "Cable Reverse Fly": ("rear_delts", ["upper_back"], "isolation", "horizontal_pull"),
    "Face Pull": ("rear_delts", ["upper_back"], "isolation", "horizontal_pull"),

    # PUSH — Triceps
    "Tricep Rope Pushdown": ("triceps", [], "isolation", "vertical_push"),
    "Tricep Pushdown": ("triceps", [], "isolation", "vertical_push"),
    "Cable Overhead Tricep Extension": ("triceps", [], "isolation", "vertical_push"),
    "Lying Tricep Extension": ("triceps", [], "isolation", "horizontal_push"),
    "Lying Dumbbell Tricep Extension": ("triceps", [], "isolation", "horizontal_push"),
    "Dumbbell Overhead Tricep Extension": ("triceps", [], "isolation", "vertical_push"),

    # PULL — Back
    "Lat Pulldown": ("lats", ["biceps", "rear_delts"], "compound", "vertical_pull"),
    "Close Grip Lat Pulldown": ("lats", ["biceps"], "compound", "vertical_pull"),
    "Neutral Grip Lat Pulldown": ("lats", ["biceps"], "compound", "vertical_pull"),
    "One Arm Lat Pulldown": ("lats", ["biceps"], "compound", "vertical_pull"),
    "Seated Cable Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "One Arm Seated Cable Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "T Bar Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "Barbell Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "Machine High Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "Machine Row": ("upper_back", ["lats", "biceps"], "compound", "horizontal_pull"),
    "Pullover Machine": ("lats", ["chest"], "isolation", "vertical_pull"),
    "Dumbbell Pullover": ("lats", ["chest"], "isolation", "vertical_pull"),
    "Pull Ups": ("lats", ["biceps"], "compound", "vertical_pull"),
    "Chin Ups": ("lats", ["biceps"], "compound", "vertical_pull"),

    # PULL — Biceps
    "Hammer Curl": ("biceps", ["forearms"], "isolation", "vertical_pull"),
    "One Arm Dumbbell Preacher Curl": ("biceps", [], "isolation", "vertical_pull"),
    "Preacher Curl": ("biceps", [], "isolation", "vertical_pull"),
    "Incline Dumbbell Curl": ("biceps", [], "isolation", "vertical_pull"),
    "EZ Bar Curl": ("biceps", [], "isolation", "vertical_pull"),
    "EZ Bar Spider Curl": ("biceps", [], "isolation", "vertical_pull"),
    "Barbell Curl": ("biceps", [], "isolation", "vertical_pull"),
    "Cable Curl": ("biceps", [], "isolation", "vertical_pull"),
    "Machine Preacher Curl": ("biceps", [], "isolation", "vertical_pull"),

    # LEGS — Quad dominant
    "Sled Leg Press": ("quads", ["glutes"], "compound", "squat"),
    "Leg Extension": ("quads", [], "isolation", "squat"),
    "Smith Machine Squat": ("quads", ["glutes", "hamstrings"], "compound", "squat"),
    "Hack Squat": ("quads", ["glutes"], "compound", "squat"),
    "Squat": ("quads", ["glutes", "hamstrings"], "compound", "squat"),
    "Pendulum Squat": ("quads", ["glutes"], "compound", "squat"),
    "Dumbbell Lunge": ("quads", ["glutes", "hamstrings"], "compound", "unilateral"),
    "Walking Lunge": ("quads", ["glutes", "hamstrings"], "compound", "unilateral"),
    "Bulgarian Split Squat": ("quads", ["glutes", "hamstrings"], "compound", "unilateral"),

    # LEGS — Hamstring / posterior
    "Romanian Deadlift": ("hamstrings", ["glutes", "lower_back"], "compound", "hinge"),
    "Dumbbell Romanian Deadlift": ("hamstrings", ["glutes", "lower_back"], "compound", "hinge"),
    "Lying Leg Curl": ("hamstrings", [], "isolation", "hinge"),
    "Seated Leg Curl": ("hamstrings", [], "isolation", "hinge"),
    "Deadlift": ("hamstrings", ["glutes", "lower_back", "quads"], "compound", "hinge"),

    # LEGS — Glutes / other
    "Hip Abduction": ("glutes", [], "isolation", "unilateral"),
    "Hip Thrust": ("glutes", ["hamstrings"], "compound", "hinge"),
    "Glute Kickback": ("glutes", [], "isolation", "hinge"),
    "Standing Calf Raise": ("calves", [], "isolation", "squat"),
    "Seated Calf Raise": ("calves", [], "isolation", "squat"),

    # CORE
    "Double Crunches": ("core", [], "isolation", "core"),
    "Crunches": ("core", [], "isolation", "core"),
    "Plank": ("core", [], "isolation", "core"),
    "Dead Hang": ("forearms", [], "isolation", "vertical_pull"),

    # CARDIO
    "Cycling": ("cardio", [], "cardio", "cardio"),
    "Elliptical": ("cardio", [], "cardio", "cardio"),
    "Treadmill": ("cardio", [], "cardio", "cardio"),
    "Running": ("cardio", [], "cardio", "cardio"),
    "Stairmaster": ("cardio", [], "cardio", "cardio"),
    "Swimming": ("cardio", [], "cardio", "cardio"),

    # Catch-all for Push Ups
    "Push Ups": ("chest", ["triceps", "front_delts"], "compound", "horizontal_push"),
}


def canonicalize(name: str) -> str:
    key = name.strip().lower()
    if key in CANONICAL_NAMES:
        return CANONICAL_NAMES[key]
    # Try exact match (case-insensitive)
    for meta_name in EXERCISE_META:
        if meta_name.lower() == key:
            return meta_name
    return name.strip()


# ─── MUSCLE GROUP → SPLIT CLASSIFICATION ─────────────────────────────────

PUSH_MUSCLES = {"chest", "front_delts", "side_delts", "triceps"}
PULL_MUSCLES = {"lats", "upper_back", "rear_delts", "biceps", "forearms"}
LEG_MUSCLES = {"quads", "hamstrings", "glutes", "calves"}
CORE_MUSCLES = {"core"}

def classify_session_split(exercises: list[dict]) -> str:
    """Classify session into push/pull/legs/upper/lower/mixed based on primary muscles hit."""
    muscles_hit: set[str] = set()
    for ex in exercises:
        canonical = canonicalize(ex["name"])
        if canonical in EXERCISE_META:
            muscles_hit.add(EXERCISE_META[canonical][0])

    push_count = len(muscles_hit & PUSH_MUSCLES)
    pull_count = len(muscles_hit & PULL_MUSCLES)
    leg_count = len(muscles_hit & LEG_MUSCLES)

    total = push_count + pull_count + leg_count
    if total == 0:
        return "unknown"

    # Check for dominant split
    if leg_count >= 2 and push_count == 0 and pull_count == 0:
        return "legs"
    if push_count >= 2 and pull_count == 0 and leg_count == 0:
        return "push"
    if pull_count >= 2 and push_count == 0 and leg_count == 0:
        return "pull"
    if push_count >= 1 and pull_count >= 1 and leg_count == 0:
        return "upper"
    if leg_count >= 1 and (push_count >= 1 or pull_count >= 1):
        return "full_body"

    # Fallback
    if push_count > 0 and pull_count == 0 and leg_count == 0:
        return "push"
    if pull_count > 0 and push_count == 0 and leg_count == 0:
        return "pull"
    if leg_count > 0 and push_count == 0 and pull_count == 0:
        return "legs"

    return "mixed"


# ─── ANALYSIS ────────────────────────────────────────────────────────────

def analyze(sessions: list[dict]) -> dict[str, Any]:
    results: dict[str, Any] = {}

    # Parse dates
    dates: list[datetime] = []
    for s in sessions:
        try:
            dates.append(datetime.fromisoformat(s["date"]))
        except (ValueError, KeyError):
            dates.append(None)

    valid_sessions = [(s, d) for s, d in zip(sessions, dates) if d is not None]
    valid_sessions.sort(key=lambda x: x[1])

    total_sessions = len(valid_sessions)
    first_date = valid_sessions[0][1]
    last_date = valid_sessions[-1][1]
    total_weeks = max(1, (last_date - first_date).days / 7.0)

    # ─── GLOBAL METRICS ──────────────────────────────────────────────
    durations = [s["duration_minutes"] for s, _ in valid_sessions if s.get("duration_minutes", 0) > 0]
    volumes = [s["total_session_volume_lbs"] for s, _ in valid_sessions if s.get("total_session_volume_lbs", 0) > 0]

    avg_duration = sum(durations) / len(durations) if durations else 0
    avg_volume = sum(volumes) / len(volumes) if volumes else 0
    avg_sessions_per_week = total_sessions / total_weeks

    weekly_volumes: dict[str, float] = defaultdict(float)
    for s, d in valid_sessions:
        week_key = d.strftime("%Y-W%U")
        weekly_volumes[week_key] += s.get("total_session_volume_lbs", 0)
    avg_weekly_volume = sum(weekly_volumes.values()) / len(weekly_volumes) if weekly_volumes else 0

    bodyweights = [s["bodyweight_lbs"] for s, _ in valid_sessions if s.get("bodyweight_lbs", 0) > 0]

    results["global_metrics"] = {
        "total_sessions": total_sessions,
        "date_range": f"{first_date.strftime('%Y-%m-%d')} to {last_date.strftime('%Y-%m-%d')}",
        "total_weeks": round(total_weeks, 1),
        "avg_sessions_per_week": round(avg_sessions_per_week, 2),
        "avg_session_duration_minutes": round(avg_duration, 1),
        "avg_session_volume_lbs": round(avg_volume, 0),
        "avg_weekly_volume_lbs": round(avg_weekly_volume, 0),
        "bodyweight_start_lbs": bodyweights[0] if bodyweights else "unknown",
        "bodyweight_end_lbs": bodyweights[-1] if bodyweights else "unknown",
        "bodyweight_delta_lbs": round(bodyweights[-1] - bodyweights[0], 1) if len(bodyweights) >= 2 else "unknown"
    }

    # ─── FREQUENCY PATTERNS ──────────────────────────────────────────
    splits = []
    for s, d in valid_sessions:
        split = classify_session_split(s.get("exercises", []))
        splits.append(split)

    split_counter = Counter(splits)
    day_of_week_counter = Counter()
    for s, d in valid_sessions:
        day_of_week_counter[d.strftime("%A")] += 1

    # Rest intervals
    rest_intervals: list[float] = []
    for i in range(1, len(valid_sessions)):
        delta = (valid_sessions[i][1] - valid_sessions[i-1][1]).total_seconds() / 86400.0
        if delta > 0:
            rest_intervals.append(delta)

    avg_rest = sum(rest_intervals) / len(rest_intervals) if rest_intervals else 0

    results["frequency_patterns"] = {
        "split_distribution": dict(split_counter.most_common()),
        "dominant_split": split_counter.most_common(1)[0][0] if split_counter else "unknown",
        "training_day_frequency": dict(day_of_week_counter.most_common()),
        "avg_rest_between_sessions_days": round(avg_rest, 2),
        "median_rest_between_sessions_days": round(sorted(rest_intervals)[len(rest_intervals)//2], 2) if rest_intervals else 0
    }

    # ─── EXERCISE-LEVEL ANALYSIS ─────────────────────────────────────
    exercise_data: dict[str, dict] = defaultdict(lambda: {
        "session_count": 0,
        "total_sets": 0,
        "all_reps": [],
        "all_weights": [],
        "working_weights": [],  # exclude warmups, exclude weight=0
        "total_volume": 0.0,
        "drop_set_count": 0,
        "warmup_set_count": 0,
        "normal_set_count": 0,
        "sessions_with_drops": 0,
        "sessions_with_warmups": 0,
        "session_ids": set(),
    })

    total_dataset_volume = 0.0
    for idx, (s, d) in enumerate(valid_sessions):
        for ex in s.get("exercises", []):
            canonical = canonicalize(ex["name"])
            ed = exercise_data[canonical]

            if idx not in ed["session_ids"]:
                ed["session_count"] += 1
                ed["session_ids"].add(idx)

            has_drop = False
            has_warmup = False

            for st in ex.get("sets", []):
                ed["total_sets"] += 1
                ed["all_reps"].append(st["reps"])

                if st["type"] == "warmup":
                    ed["warmup_set_count"] += 1
                    has_warmup = True
                elif st["type"] == "drop":
                    ed["drop_set_count"] += 1
                    has_drop = True
                    if st["weight"] > 0:
                        ed["all_weights"].append(st["weight"])
                        ed["working_weights"].append(st["weight"])
                else:
                    ed["normal_set_count"] += 1
                    if st["weight"] > 0:
                        ed["all_weights"].append(st["weight"])
                        ed["working_weights"].append(st["weight"])

            ed["total_volume"] += ex.get("total_volume_lbs", 0)
            total_dataset_volume += ex.get("total_volume_lbs", 0)

            if has_drop:
                ed["sessions_with_drops"] += 1
            if has_warmup:
                ed["sessions_with_warmups"] += 1

    # ─── TOP 15 INTENSITY PATTERNS ───────────────────────────────────
    top_15_by_freq = sorted(exercise_data.items(), key=lambda x: x[1]["session_count"], reverse=True)[:15]

    intensity_patterns: list[dict] = []
    for name, data in top_15_by_freq:
        reps = data["all_reps"]
        weights = data["working_weights"]
        total_set_count = data["total_sets"]

        intensity_patterns.append({
            "exercise": name,
            "session_count": data["session_count"],
            "typical_rep_range": f"{sorted(reps)[len(reps)//4]}-{sorted(reps)[3*len(reps)//4]}" if reps else "N/A",
            "avg_reps": round(sum(reps) / len(reps), 1) if reps else 0,
            "typical_weight_range_lbs": f"{sorted(weights)[len(weights)//4]:.0f}-{sorted(weights)[3*len(weights)//4]:.0f}" if len(weights) >= 4 else (f"{min(weights):.0f}-{max(weights):.0f}" if weights else "bodyweight"),
            "max_weight_lbs": max(weights) if weights else 0,
            "drop_set_frequency_pct": round(100 * data["sessions_with_drops"] / data["session_count"], 1) if data["session_count"] > 0 else 0,
            "warmup_frequency_pct": round(100 * data["sessions_with_warmups"] / data["session_count"], 1) if data["session_count"] > 0 else 0
        })

    results["intensity_patterns"] = intensity_patterns

    # ─── VOLUME PROFILE ──────────────────────────────────────────────
    sorted_volumes = sorted(volumes)
    p75_idx = int(len(sorted_volumes) * 0.75)
    p75_volume = sorted_volumes[p75_idx] if sorted_volumes else 0

    # Outliers: > mean + 2*std
    mean_vol = sum(volumes) / len(volumes) if volumes else 0
    var_vol = sum((v - mean_vol)**2 for v in volumes) / len(volumes) if volumes else 0
    std_vol = var_vol ** 0.5
    outlier_threshold = mean_vol + 2 * std_vol
    outlier_sessions = []
    for s, d in valid_sessions:
        vol = s.get("total_session_volume_lbs", 0)
        if vol > outlier_threshold:
            outlier_sessions.append({
                "date": d.strftime("%Y-%m-%d"),
                "volume_lbs": vol
            })

    # Recovery pattern: sessions after high volume (>p75)
    recovery_signals: list[dict] = []
    for i in range(1, len(valid_sessions)):
        prev_vol = valid_sessions[i-1][0].get("total_session_volume_lbs", 0)
        if prev_vol > p75_volume:
            rest = (valid_sessions[i][1] - valid_sessions[i-1][1]).total_seconds() / 86400.0
            recovery_signals.append(rest)

    avg_recovery_after_high_vol = round(sum(recovery_signals) / len(recovery_signals), 2) if recovery_signals else "insufficient signal"

    results["volume_profile"] = {
        "avg_session_volume_lbs": round(mean_vol, 0),
        "std_session_volume_lbs": round(std_vol, 0),
        "p75_session_volume_lbs": round(p75_volume, 0),
        "min_session_volume_lbs": round(min(volumes), 0) if volumes else 0,
        "max_session_volume_lbs": round(max(volumes), 0) if volumes else 0,
        "outlier_high_volume_sessions": outlier_sessions[:10],
        "outlier_threshold_lbs": round(outlier_threshold, 0),
        "avg_rest_after_high_volume_days": avg_recovery_after_high_vol
    }

    # ─── STRENGTH PROFILE ────────────────────────────────────────────
    compound_exercises = {}
    for name, data in exercise_data.items():
        canonical = canonicalize(name)
        if canonical in EXERCISE_META and EXERCISE_META[canonical][2] == "compound":
            if data["working_weights"]:
                compound_exercises[name] = {
                    "max_weight_lbs": max(data["working_weights"]),
                    "avg_working_weight_lbs": round(sum(data["working_weights"]) / len(data["working_weights"]), 1),
                    "session_count": data["session_count"]
                }

    # Determine if hypertrophy-dominant or strength-biased
    all_reps_flat = []
    for name, data in exercise_data.items():
        all_reps_flat.extend(data["all_reps"])

    avg_global_reps = sum(all_reps_flat) / len(all_reps_flat) if all_reps_flat else 0
    hypertrophy_pct = sum(1 for r in all_reps_flat if 8 <= r <= 15) / len(all_reps_flat) * 100 if all_reps_flat else 0
    strength_pct = sum(1 for r in all_reps_flat if 1 <= r <= 5) / len(all_reps_flat) * 100 if all_reps_flat else 0
    endurance_pct = sum(1 for r in all_reps_flat if r > 15) / len(all_reps_flat) * 100 if all_reps_flat else 0

    if hypertrophy_pct > 60:
        strength_bias = "hypertrophy_dominant"
    elif strength_pct > 30:
        strength_bias = "strength_biased"
    else:
        strength_bias = "mixed"

    # Top compound lifts by max weight
    top_compounds = sorted(compound_exercises.items(), key=lambda x: x[1]["max_weight_lbs"], reverse=True)[:10]

    results["strength_profile"] = {
        "estimated_profile": strength_bias,
        "rep_distribution": {
            "strength_1_5_pct": round(strength_pct, 1),
            "hypertrophy_8_15_pct": round(hypertrophy_pct, 1),
            "endurance_15plus_pct": round(endurance_pct, 1),
            "avg_global_reps": round(avg_global_reps, 1)
        },
        "top_compound_lifts": {name: data for name, data in top_compounds}
    }

    # ─── PROGRESSION MODEL ───────────────────────────────────────────
    # For each high-frequency compound, check weight progression over time
    progression_signals: dict[str, str] = {}
    for name, data in exercise_data.items():
        if data["session_count"] < 10:
            continue
        canonical = canonicalize(name)
        if canonical not in EXERCISE_META or EXERCISE_META[canonical][2] != "compound":
            continue

        # Gather weights in chronological order
        chrono_weights: list[float] = []
        for idx, (s, d) in enumerate(valid_sessions):
            for ex in s.get("exercises", []):
                if canonicalize(ex["name"]) == canonical:
                    working_w = [st["weight"] for st in ex.get("sets", []) if st["type"] == "normal" and st["weight"] > 0]
                    if working_w:
                        chrono_weights.append(max(working_w))

        if len(chrono_weights) < 5:
            continue

        # Simple trend detection
        first_third = chrono_weights[:len(chrono_weights)//3]
        last_third = chrono_weights[2*len(chrono_weights)//3:]
        avg_first = sum(first_third) / len(first_third)
        avg_last = sum(last_third) / len(last_third)
        change_pct = ((avg_last - avg_first) / avg_first) * 100 if avg_first > 0 else 0

        # Check variance
        diffs = [chrono_weights[i+1] - chrono_weights[i] for i in range(len(chrono_weights)-1)]
        positive_diffs = sum(1 for d in diffs if d > 0)
        negative_diffs = sum(1 for d in diffs if d < 0)
        zero_diffs = sum(1 for d in diffs if d == 0)

        if change_pct > 10 and positive_diffs > negative_diffs * 2:
            model = "linear_progression"
        elif zero_diffs > len(diffs) * 0.5 and change_pct < 5:
            model = "plateau_maintenance"
        elif positive_diffs > 0 and negative_diffs > 0 and abs(positive_diffs - negative_diffs) < len(diffs) * 0.3:
            model = "undulating"
        else:
            model = "double_progression_likely"

        progression_signals[name] = model

    # Overall model
    model_counter = Counter(progression_signals.values())
    dominant_model = model_counter.most_common(1)[0][0] if model_counter else "insufficient signal"

    results["progression_model_detected"] = {
        "dominant_model": dominant_model,
        "per_exercise_signals": progression_signals
    }

    # ═══════════════════════════════════════════════════════════════════
    # EXERCISE LIBRARY
    # ═══════════════════════════════════════════════════════════════════
    exercise_library: list[dict] = []
    for name, data in sorted(exercise_data.items(), key=lambda x: x[1]["session_count"], reverse=True):
        canonical = canonicalize(name)
        meta = EXERCISE_META.get(canonical, ("unknown", [], "unknown", "unknown"))

        reps = data["all_reps"]
        weights = data["working_weights"]
        vol_contribution = round(100 * data["total_volume"] / total_dataset_volume, 2) if total_dataset_volume > 0 else 0

        freq_score = "high" if data["session_count"] > total_sessions * 0.15 else ("medium" if data["session_count"] > total_sessions * 0.05 else "low")

        # Determine if strength anchor
        is_anchor = False
        if canonical in EXERCISE_META and EXERCISE_META[canonical][2] == "compound" and weights:
            if max(weights) > 100:  # heuristic
                is_anchor = True

        notes_parts: list[str] = []
        if is_anchor:
            notes_parts.append("strength_anchor")
        if freq_score == "high":
            notes_parts.append("high_frequency_staple")
        if data["drop_set_count"] > data["total_sets"] * 0.25:
            notes_parts.append("heavy_drop_set_usage")

        exercise_library.append({
            "name": canonical,
            "primary_muscle": meta[0],
            "secondary_muscles": meta[1],
            "type": meta[2],
            "movement_pattern": meta[3],
            "avg_reps": round(sum(reps) / len(reps), 1) if reps else 0,
            "avg_weight_lbs": round(sum(weights) / len(weights), 1) if weights else 0,
            "max_weight_detected_lbs": max(weights) if weights else 0,
            "session_count": data["session_count"],
            "frequency_score": freq_score,
            "total_sets": data["total_sets"],
            "volume_contribution_pct": vol_contribution,
            "drop_set_usage_rate_pct": round(100 * data["drop_set_count"] / data["total_sets"], 1) if data["total_sets"] > 0 else 0,
            "warmup_usage_rate_pct": round(100 * data["warmup_set_count"] / data["total_sets"], 1) if data["total_sets"] > 0 else 0,
            "notes": ", ".join(notes_parts) if notes_parts else ""
        })

    # ═══════════════════════════════════════════════════════════════════
    # PROGRAM CONSTRAINTS
    # ═══════════════════════════════════════════════════════════════════
    constraints: dict[str, Any] = {}

    # Time constraints
    sorted_durations = sorted(durations)
    constraints["time_window"] = {
        "typical_duration_minutes": f"{sorted_durations[len(sorted_durations)//4]:.0f}-{sorted_durations[3*len(sorted_durations)//4]:.0f}" if sorted_durations else "unknown",
        "avg_duration_minutes": round(avg_duration, 1),
        "longest_session_minutes": round(max(durations), 1) if durations else 0,
        "shortest_effective_session_minutes": round(sorted_durations[int(len(sorted_durations)*0.05)], 1) if sorted_durations else 0,
        "p10_duration_minutes": round(sorted_durations[int(len(sorted_durations)*0.10)], 1) if sorted_durations else 0,
        "p90_duration_minutes": round(sorted_durations[int(len(sorted_durations)*0.90)], 1) if sorted_durations else 0
    }

    # Volume constraints
    constraints["volume_limits"] = {
        "avg_session_volume_lbs": round(mean_vol, 0),
        "safe_volume_ceiling_lbs": round(p75_volume + (p75_volume - mean_vol) * 0.5, 0),
        "safe_volume_floor_lbs": round(sorted_volumes[int(len(sorted_volumes)*0.10)], 0) if sorted_volumes else 0,
        "optimal_session_volume_window_lbs": f"{sorted_volumes[int(len(sorted_volumes)*0.25)]:.0f}-{sorted_volumes[int(len(sorted_volumes)*0.75)]:.0f}" if sorted_volumes else "unknown",
        "p25_volume_lbs": round(sorted_volumes[int(len(sorted_volumes)*0.25)], 0) if sorted_volumes else 0,
        "p75_volume_lbs": round(p75_volume, 0)
    }

    # Frequency constraints
    # Weekly session counts
    weekly_sessions: dict[str, int] = defaultdict(int)
    for s, d in valid_sessions:
        week_key = d.strftime("%Y-W%U")
        weekly_sessions[week_key] += 1

    weekly_counts = list(weekly_sessions.values())
    sorted_weekly = sorted(weekly_counts)

    # Overreaching signals: weeks with > p90 sessions or volume
    p90_weekly_sessions = sorted_weekly[int(len(sorted_weekly)*0.9)] if sorted_weekly else 0
    overreaching_weeks = sum(1 for wc in weekly_counts if wc > p90_weekly_sessions)

    constraints["frequency_limits"] = {
        "avg_sessions_per_week": round(avg_sessions_per_week, 2),
        "sustainable_weekly_frequency": f"{sorted_weekly[int(len(sorted_weekly)*0.25)]}-{sorted_weekly[int(len(sorted_weekly)*0.75)]}" if sorted_weekly else "unknown",
        "max_observed_weekly_sessions": max(weekly_counts) if weekly_counts else 0,
        "p90_weekly_sessions": p90_weekly_sessions,
        "overreaching_weeks_count": overreaching_weeks,
        "recovery_bandwidth_days": round(avg_rest, 2)
    }

    # Exercise bias
    push_volume = 0
    pull_volume = 0
    upper_volume = 0
    lower_volume = 0
    isolation_count = 0
    compound_count = 0

    for name, data in exercise_data.items():
        canonical = canonicalize(name)
        if canonical not in EXERCISE_META:
            continue
        meta = EXERCISE_META[canonical]
        primary = meta[0]
        ex_type = meta[2]

        if primary in PUSH_MUSCLES:
            push_volume += data["total_volume"]
            upper_volume += data["total_volume"]
        elif primary in PULL_MUSCLES:
            pull_volume += data["total_volume"]
            upper_volume += data["total_volume"]
        elif primary in LEG_MUSCLES:
            lower_volume += data["total_volume"]

        if ex_type == "compound":
            compound_count += data["total_sets"]
        elif ex_type == "isolation":
            isolation_count += data["total_sets"]

    total_push_pull = push_volume + pull_volume
    total_upper_lower = upper_volume + lower_volume

    constraints["exercise_bias"] = {
        "push_volume_pct": round(100 * push_volume / total_push_pull, 1) if total_push_pull > 0 else 0,
        "pull_volume_pct": round(100 * pull_volume / total_push_pull, 1) if total_push_pull > 0 else 0,
        "push_pull_ratio": f"{push_volume/pull_volume:.2f}:1" if pull_volume > 0 else "N/A",
        "upper_volume_pct": round(100 * upper_volume / total_upper_lower, 1) if total_upper_lower > 0 else 0,
        "lower_volume_pct": round(100 * lower_volume / total_upper_lower, 1) if total_upper_lower > 0 else 0,
        "upper_lower_ratio": f"{upper_volume/lower_volume:.2f}:1" if lower_volume > 0 else "N/A",
        "compound_set_pct": round(100 * compound_count / (compound_count + isolation_count), 1) if (compound_count + isolation_count) > 0 else 0,
        "isolation_set_pct": round(100 * isolation_count / (compound_count + isolation_count), 1) if (compound_count + isolation_count) > 0 else 0,
        "compound_isolation_ratio": f"{compound_count/isolation_count:.2f}:1" if isolation_count > 0 else "N/A"
    }

    # Fatigue signals
    # Drop set clustering: consecutive sessions with drop sets
    drop_set_sessions: list[int] = []
    for idx, (s, d) in enumerate(valid_sessions):
        has_drop = any(
            st["type"] == "drop"
            for ex in s.get("exercises", [])
            for st in ex.get("sets", [])
        )
        if has_drop:
            drop_set_sessions.append(idx)

    # Back-to-back muscle overlap
    muscle_overlap_count = 0
    for i in range(1, len(valid_sessions)):
        prev_muscles = set()
        curr_muscles = set()
        for ex in valid_sessions[i-1][0].get("exercises", []):
            canonical = canonicalize(ex["name"])
            if canonical in EXERCISE_META:
                prev_muscles.add(EXERCISE_META[canonical][0])
        for ex in valid_sessions[i][0].get("exercises", []):
            canonical = canonicalize(ex["name"])
            if canonical in EXERCISE_META:
                curr_muscles.add(EXERCISE_META[canonical][0])

        rest = (valid_sessions[i][1] - valid_sessions[i-1][1]).total_seconds() / 86400.0
        if prev_muscles & curr_muscles and rest <= 1.5:
            muscle_overlap_count += 1

    # High volume lower stacking
    lower_stacking = 0
    for i in range(1, len(valid_sessions)):
        prev_is_lower = classify_session_split(valid_sessions[i-1][0].get("exercises", [])) == "legs"
        curr_is_lower = classify_session_split(valid_sessions[i][0].get("exercises", [])) == "legs"
        rest = (valid_sessions[i][1] - valid_sessions[i-1][1]).total_seconds() / 86400.0
        if prev_is_lower and curr_is_lower and rest <= 2:
            lower_stacking += 1

    # Drop set clustering: sessions where > 50% of sets are drops
    heavy_drop_sessions = 0
    total_drop_sets_global = 0
    total_sets_global = 0
    for s, d in valid_sessions:
        session_drops = 0
        session_total = 0
        for ex in s.get("exercises", []):
            for st in ex.get("sets", []):
                session_total += 1
                if st["type"] == "drop":
                    session_drops += 1
        total_drop_sets_global += session_drops
        total_sets_global += session_total
        if session_total > 0 and session_drops / session_total > 0.3:
            heavy_drop_sessions += 1

    constraints["fatigue_model"] = {
        "sessions_with_drop_sets": len(drop_set_sessions),
        "sessions_with_drop_sets_pct": round(100 * len(drop_set_sessions) / total_sessions, 1),
        "heavy_drop_sessions_30pct_plus": heavy_drop_sessions,
        "global_drop_set_rate_pct": round(100 * total_drop_sets_global / total_sets_global, 1) if total_sets_global > 0 else 0,
        "back_to_back_muscle_overlap_count": muscle_overlap_count,
        "high_volume_lower_stacking_count": lower_stacking,
        "fatigue_risk_assessment": "moderate" if muscle_overlap_count > total_sessions * 0.1 else "low"
    }

    return {
        "ATHLETE_PROFILE": results,
        "EXERCISE_LIBRARY": exercise_library,
        "PROGRAM_CONSTRAINTS": constraints
    }


# ─── MAIN ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    filepath = "/home/pablo/gym/jose_alpizar_structured.txt"
    print(f"Parsing {filepath}...", file=sys.stderr)

    sessions = parse_structured_file(filepath)
    print(f"Parsed {len(sessions)} sessions.", file=sys.stderr)

    output = analyze(sessions)

    # Print each artifact separately for clarity
    print("=" * 80)
    print("ATHLETE_PROFILE")
    print("=" * 80)
    print(json.dumps(output["ATHLETE_PROFILE"], indent=2, default=str))

    print("\n" + "=" * 80)
    print("EXERCISE_LIBRARY")
    print("=" * 80)
    print(json.dumps(output["EXERCISE_LIBRARY"], indent=2, default=str))

    print("\n" + "=" * 80)
    print("PROGRAM_CONSTRAINTS")
    print("=" * 80)
    print(json.dumps(output["PROGRAM_CONSTRAINTS"], indent=2, default=str))
