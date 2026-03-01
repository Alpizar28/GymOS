"""Telegram output formatters — MarkdownV2 for plans, stats, confirmations."""


def escape_md(text: str) -> str:
    """Escape special characters for Telegram MarkdownV2."""
    special = r"_*[]()~`>#+-=|{}.!"
    result = ""
    for char in str(text):
        if char in special:
            result += f"\\{char}"
        else:
            result += char
    return result


def format_plan(plan: dict) -> str:
    """Format a day plan for Telegram display."""
    lines = []
    day_name = plan.get("day_name", "Workout")
    duration = plan.get("estimated_duration_min", "?")

    lines.append(f"🏋️ *{escape_md(day_name)}*")
    lines.append(f"⏱ \\~{escape_md(str(duration))} min")
    lines.append("")

    for i, exercise in enumerate(plan.get("exercises", []), 1):
        name = exercise.get("name", "Unknown")
        is_anchor = exercise.get("is_anchor", False)
        icon = "🔴" if is_anchor else "⚪"

        lines.append(f"{icon} *{escape_md(name)}*")

        for s in exercise.get("sets", []):
            st = s.get("set_type", "normal")
            weight = s.get("weight_lbs", 0)
            reps = s.get("target_reps", 0)
            rir = s.get("rir_target", "")
            rest = s.get("rest_seconds", 0)

            prefix = ""
            if st == "warmup":
                prefix = "🟡 "
            elif st == "drop":
                prefix = "🔻 "

            rir_str = f" RIR {rir}" if rir != "" else ""
            rest_str = f" \\| {rest}s rest" if rest else ""
            lines.append(
                f"  {prefix}{escape_md(str(weight))}lb × {escape_md(str(reps))}"
                f"{escape_md(rir_str)}{rest_str}"
            )

        notes = exercise.get("notes", "")
        if notes:
            lines.append(f"  💡 _{escape_md(notes)}_")
        lines.append("")

    total_sets = plan.get("total_sets", 0)
    total_vol = plan.get("estimated_volume_lbs", 0)
    if total_vol:
        lines.append(
            f"📊 {escape_md(str(total_sets))} sets \\| "
            f"\\~{escape_md(str(int(total_vol)))} lbs volume"
        )

    note = plan.get("note", "")
    if note:
        lines.append(f"\n⚠️ _{escape_md(note)}_")

    return "\n".join(lines)


def format_stats(stats: dict) -> str:
    """Format weekly stats summary for Telegram."""
    lines = []
    lines.append(f"📊 *Weekly Stats*")
    lines.append(f"📅 {escape_md(stats.get('week', ''))}")
    lines.append("")
    lines.append(f"🏋️ Sessions: {escape_md(str(stats.get('workouts', 0)))}")
    lines.append(f"📝 Total sets: {escape_md(str(stats.get('total_sets', 0)))}")
    lines.append(
        f"💪 Volume: {escape_md(str(int(stats.get('total_volume_lbs', 0))))} lbs"
    )
    lines.append(f"😓 Fatigue: {escape_md(str(stats.get('fatigue_score', 0)))}/10")
    lines.append("")

    anchor_progress = stats.get("anchor_progress", [])
    if anchor_progress:
        lines.append("*Anchor Progress:*")
        for ap in anchor_progress:
            status_icon = {"active": "🟢", "deload": "🟡", "consolidate": "🔵"}.get(
                ap.get("status", "active"), "⚪"
            )
            streak_str = f" 🔥{ap['streak']}" if ap.get("streak", 0) > 0 else ""
            lines.append(
                f"{status_icon} {escape_md(ap['exercise'])}: "
                f"{escape_md(str(ap['target_weight']))}lb × {escape_md(ap['reps_range'])}"
                f"{streak_str}"
            )

    return "\n".join(lines)


def format_log_confirmation(workout_id: int, exercises_count: int) -> str:
    """Format workout log confirmation."""
    return (
        f"✅ Workout \\#{escape_md(str(workout_id))} logged\\!\n"
        f"📝 {escape_md(str(exercises_count))} exercises recorded\\.\n\n"
        f"Use /done to complete the session and log fatigue\\."
    )


def format_progression_results(results: list[dict]) -> str:
    """Format progression update results."""
    if not results:
        return "No anchor exercises found in this workout\\."

    lines = ["📈 *Progression Updates:*", ""]
    for r in results:
        action_icons = {
            "increase_weight": "⬆️",
            "increase_reps": "➡️",
            "consolidate": "🔄",
            "deload": "⬇️",
            "no_data": "❓",
        }
        icon = action_icons.get(r.get("action", ""), "❓")
        lines.append(
            f"{icon} *{escape_md(r['exercise_name'])}*: {escape_md(r['reason'])}"
        )
        if r.get("old_weight") != r.get("new_weight"):
            lines.append(
                f"  {escape_md(str(r['old_weight']))} → {escape_md(str(r['new_weight']))} lbs"
            )

    return "\n".join(lines)
