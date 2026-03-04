"""Prompt templates for LLM plan generation and validation."""

GENERATE_DAY_PLAN_SYSTEM = """You are a hypertrophy-focused strength training coach.
You generate structured workout plans as JSON.

RULES:
- Follow the athlete's established patterns and preferences
- Anchor exercises MUST use the specified target weight and rep range
- Respect volume and time constraints strictly
- Include warmup sets for compound anchors
- Order exercises: compounds first, then isolations
- Include rest periods (seconds)
- Use only exercises from the provided library subset

OUTPUT FORMAT (JSON only, no other text):
{
  "day_name": "string",
  "estimated_duration_min": number,
  "exercises": [
    {
      "name": "string",
      "is_anchor": boolean,
      "sets": [
        {
          "set_type": "warmup|normal|drop",
          "weight_lbs": number,
          "target_reps": number,
          "rir_target": number,
          "rest_seconds": number
        }
      ],
      "notes": "optional coaching cue"
    }
  ],
  "total_sets": number,
  "estimated_volume_lbs": number
}"""


def build_generate_day_prompt(
    day_name: str,
    day_focus: str,
    day_rules: dict,
    anchor_targets: list[dict],
    exercise_subset: list[dict],
    constraints: dict,
    fatigue_score: float,
    progression_hints: list[dict],
) -> str:
    """Build the user prompt for GenerateDayPlan."""
    import json

    return f"""Generate today's workout plan.

## Template Day
- Name: {day_name}
- Focus: {day_focus}
- Max exercises: {day_rules.get('max_exercises', 6)}
- Max sets: {day_rules.get('max_sets', 20)}
- Allow drop sets: {day_rules.get('allow_drop_sets', False)}

## Anchor Targets (MUST follow these exactly)
{json.dumps(anchor_targets, indent=2)}

## Available Exercises (pick from these ONLY)
{json.dumps(exercise_subset, indent=2)}

## Progression Hints (use when selecting weights/reps/sets)
{json.dumps(progression_hints, indent=2)}

## Constraints
- Session duration: {constraints.get('typical_duration_minutes', '60-90')} min
- Volume window: {constraints.get('optimal_session_volume_window_lbs', '14000-23000')} lbs
- Current fatigue: {fatigue_score}/10

## Instructions
1. Start with the anchor exercise(s) — use EXACT target weight/reps
2. Add 3-5 accessory exercises matching the day's focus
3. Keep total volume within the safe window
4. If fatigue > 7, reduce total sets by 20%
5. Include 1-2 warmup sets for compound anchors
6. Apply progression hints where available (increase weight/reps/sets if suggested)"""


VALIDATE_PLAN_SYSTEM = """You are a training plan validator.
Check the plan against constraints and return corrections.

OUTPUT FORMAT (JSON only):
{
  "is_valid": boolean,
  "violations": ["string"],
  "corrected_plan": { ... } | null
}"""


def build_validate_prompt(plan_json: dict, constraints: dict) -> str:
    """Build the user prompt for ValidatePlan."""
    import json

    return f"""Validate this workout plan against the constraints.

## Plan
{json.dumps(plan_json, indent=2)}

## Constraints
{json.dumps(constraints, indent=2)}

Check:
1. Total sets within max
2. Volume within safe window
3. All exercises exist in the library
4. Anchor weights match targets
5. Session duration is reasonable"""


SUMMARIZE_STATS_SYSTEM = """You are a training analyst.
Generate a brief, actionable weekly summary.
Be concise — max 5 bullet points. Use numbers. No fluff."""


def build_summarize_prompt(stats: dict) -> str:
    """Build the user prompt for SummarizeStats."""
    import json

    return f"""Summarize this week's training data:

{json.dumps(stats, indent=2)}

Focus on:
1. Progress on anchor lifts (weight/rep changes)
2. Volume trend vs target
3. Fatigue management
4. One specific recommendation for next week"""
