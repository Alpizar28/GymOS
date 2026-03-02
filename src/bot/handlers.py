"""Telegram bot command handlers."""

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from src.bot.formatters import (
    escape_md,
    format_log_confirmation,
    format_plan,
    format_progression_results,
    format_stats,
)
from src.database import async_session
from src.services.plan_generator import generate_day_plan
from src.services.progression_engine import update_anchor_after_workout
from src.services.stats_service import get_weekly_summary
from src.services.workout_logger import complete_workout, log_workout

logger = logging.getLogger(__name__)

# Conversation states
WAITING_FATIGUE = 1
WAITING_LOG = 2


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "🏋️ *Gym Training System*\n\n"
        "Commands:\n"
        "/today \\— Generate today's routine\n"
        "/week \\— Generate full week plan\n"
        "/log \\— Log a workout \\(text\\)\n"
        "/done \\— Complete session \\+ feedback\n"
        "/stats \\— Weekly summary\n"
        "/swap \\— Find exercise alternatives\n"
        "/pain \\— Activate protection mode\n",
        parse_mode=ParseMode.MARKDOWN_V2,
    )


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /today — generate today's routine."""
    await update.message.reply_text("⏳ Generating today's plan\\.\\.\\.", parse_mode=ParseMode.MARKDOWN_V2)

    try:
        async with async_session() as session:
            plan = await generate_day_plan(session)

            if plan is None:
                await update.message.reply_text("❌ Could not generate plan\\. Check logs\\.", parse_mode=ParseMode.MARKDOWN_V2)
                return

            formatted = format_plan(plan)
            await update.message.reply_text(formatted, parse_mode=ParseMode.MARKDOWN_V2)
    except Exception:
        logger.exception("Error in /today")
        await update.message.reply_text("❌ Error generating plan\\. Check logs\\.", parse_mode=ParseMode.MARKDOWN_V2)


async def cmd_log(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /log — record a workout from text.
    If no text follows the command, enter conversation mode.
    """
    text = update.message.text
    if text:
        # Remove the /log command prefix
        text = text.replace("/log", "", 1).strip()

    if not text:
        await update.message.reply_text(
            "📝 Send your workout log\\. Format:\n\n"
            "`Exercise Name WEIGHTxREPSxSETS`\n"
            "Example:\n"
            "`Bench Press 185x6x3`\n"
            "`Chest Fly 170x12, 160x12`\n\n"
            "_I'll wait for your next message\\._",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        return WAITING_LOG

    # If text was provided directly with the command
    result = await _process_and_store_log(update, context, text)
    return ConversationHandler.END


async def handle_log_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle follow-up text for workout logging."""
    text = update.message.text
    if not text:
        return WAITING_LOG

    await _process_and_store_log(update, context, text)
    return ConversationHandler.END


async def _process_and_store_log(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    """Core logic to parse, store and respond to a log."""
    try:
        async with async_session() as session:
            workout = await log_workout(session, text)

            if workout is None:
                await update.message.reply_text(
                    "❌ Could not parse workout\\. Check format\\.",
                    parse_mode=ParseMode.MARKDOWN_V2,
                )
                return

            exercises_count = len(workout.exercises) if workout.exercises else 0
            confirmation = format_log_confirmation(workout.id, exercises_count)

            # Update progression for anchors
            progression_results = await update_anchor_after_workout(session, workout.id)
            await session.commit()

            # Store workout_id for /done
            if context.user_data is not None:
                context.user_data["last_workout_id"] = workout.id

            await update.message.reply_text(confirmation, parse_mode=ParseMode.MARKDOWN_V2)

            if progression_results:
                prog_data = [
                    {
                        "exercise_name": r.exercise_name,
                        "action": r.action.value,
                        "old_weight": r.old_weight,
                        "new_weight": r.new_weight,
                        "reason": r.reason,
                    }
                    for r in progression_results
                ]
                prog_text = format_progression_results(prog_data)
                await update.message.reply_text(prog_text, parse_mode=ParseMode.MARKDOWN_V2)
    except Exception:
        logger.exception("Error in _process_and_store_log")
        await update.message.reply_text("❌ Error logging workout\\.", parse_mode=ParseMode.MARKDOWN_V2)


async def cmd_done(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /done — mark session complete, prompt for fatigue."""
    last_id = context.user_data.get("last_workout_id") if context.user_data else None

    if last_id is None:
        await update.message.reply_text(
            "❓ No recent workout to complete\\. Use /log first\\.",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        return ConversationHandler.END

    await update.message.reply_text(
        "💪 Session done\\! Rate your fatigue \\(1\\-10\\):",
        parse_mode=ParseMode.MARKDOWN_V2,
    )
    return WAITING_FATIGUE


async def handle_fatigue_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle fatigue rating after /done."""
    try:
        fatigue = float(update.message.text.strip())
        if not 0 <= fatigue <= 10:
            await update.message.reply_text("Please enter a number between 0 and 10\\.", parse_mode=ParseMode.MARKDOWN_V2)
            return WAITING_FATIGUE
    except (ValueError, TypeError):
        await update.message.reply_text("Please enter a number between 0 and 10\\.", parse_mode=ParseMode.MARKDOWN_V2)
        return WAITING_FATIGUE

    workout_id = context.user_data.get("last_workout_id")
    if workout_id is None:
        await update.message.reply_text("❌ No workout found\\.", parse_mode=ParseMode.MARKDOWN_V2)
        return ConversationHandler.END

    try:
        async with async_session() as session:
            await complete_workout(session, workout_id, fatigue)
            await session.commit()

        context.user_data.pop("last_workout_id", None)
        await update.message.reply_text(
            f"✅ Session #{escape_md(str(workout_id))} completed\\!\n"
            f"Fatigue: {escape_md(str(fatigue))}/10\n"
            f"Recovery day tomorrow if needed\\. 💪",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
    except Exception:
        logger.exception("Error in /done fatigue handler")
        await update.message.reply_text("❌ Error completing session\\.", parse_mode=ParseMode.MARKDOWN_V2)

    return ConversationHandler.END


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /stats — weekly summary."""
    try:
        async with async_session() as session:
            stats = await get_weekly_summary(session)
            formatted = format_stats(stats)
            await update.message.reply_text(formatted, parse_mode=ParseMode.MARKDOWN_V2)
    except Exception:
        logger.exception("Error in /stats")
        await update.message.reply_text("❌ Error getting stats\\.", parse_mode=ParseMode.MARKDOWN_V2)


async def cmd_week(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /week — generate a full week plan (6 days)."""
    await update.message.reply_text(
        "📅 Generating full week plan \\(6 days\\)\\.\\.\\.",
        parse_mode=ParseMode.MARKDOWN_V2,
    )

    try:
        async with async_session() as session:
            from sqlalchemy import select

            from src.config import settings
            from src.models.settings import WeekTemplate

            # Get all template days
            template_result = await session.execute(
                select(WeekTemplate).order_by(WeekTemplate.day_index)
            )
            templates = template_result.scalars().all()

            plans_generated = 0
            for template in templates:
                # Generate plan for specific day
                plan = await generate_day_plan(session, day_index=template.day_index)
                if plan:
                    formatted = format_plan(plan)
                    try:
                        await update.message.reply_text(
                            formatted, parse_mode=ParseMode.MARKDOWN_V2
                        )
                    except Exception:
                        # Fallback to plain text if MarkdownV2 fails
                        await update.message.reply_text(
                            f"Day {template.day_index}: {template.name}\n"
                            f"(formatting error — check web dashboard)"
                        )
                    plans_generated += 1

            await update.message.reply_text(
                f"✅ {escape_md(str(plans_generated))}/6 days generated\\!\n"
                f"View full plan at {escape_md(settings.web_url)}",
                parse_mode=ParseMode.MARKDOWN_V2,
            )
    except Exception:
        logger.exception("Error in /week")
        await update.message.reply_text(
            "❌ Error generating week plan\\.",
            parse_mode=ParseMode.MARKDOWN_V2,
        )


async def cmd_swap(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /swap <exercise> — find alternative exercises."""
    text = update.message.text or ""
    exercise_name = text.replace("/swap", "", 1).strip()

    if not exercise_name:
        await update.message.reply_text(
            "🔄 Usage: `/swap Bench Press`\n"
            "Finds similar exercises you can swap in\\.",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        return

    try:
        async with async_session() as session:
            from src.services.swap_service import find_swap_candidates
            from src.services.workout_logger import find_exercise_by_name

            exercise = await find_exercise_by_name(session, exercise_name)
            if not exercise:
                await update.message.reply_text(
                    f"❌ Exercise not found: {escape_md(exercise_name)}",
                    parse_mode=ParseMode.MARKDOWN_V2,
                )
                return

            candidates = await find_swap_candidates(session, exercise.id)
            if not candidates:
                await update.message.reply_text(
                    f"No swap candidates for {escape_md(exercise.name_canonical)}\\.",
                    parse_mode=ParseMode.MARKDOWN_V2,
                )
                return

            lines = [f"🔄 *Swaps for {escape_md(exercise.name_canonical)}:*\n"]
            for i, c in enumerate(candidates, 1):
                anchor_tag = " 🔴" if c["is_anchor"] else ""
                lines.append(
                    f"{i}\\. *{escape_md(c['name'])}*{anchor_tag}\n"
                    f"   {escape_md(c['primary_muscle'])} \\| {escape_md(c['movement_pattern'])}"
                )
            await update.message.reply_text(
                "\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2
            )
    except Exception:
        logger.exception("Error in /swap")
        await update.message.reply_text("❌ Error finding swaps\\.", parse_mode=ParseMode.MARKDOWN_V2)


async def cmd_pain(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /pain <muscle> [severity] — activate/deactivate protection mode."""
    text = update.message.text or ""
    args = text.replace("/pain", "", 1).strip().split()

    if not args:
        await update.message.reply_text(
            "🛡️ Usage:\\n"
            "`/pain chest 7` — protect chest \\(severity 1\\-10\\)\\n"
            "`/pain chest off` — deactivate chest protection\\n"
            "`/pain list` — show active protections",
            parse_mode=ParseMode.MARKDOWN_V2,
        )
        return

    try:
        async with async_session() as session:
            from src.services.protection_service import (
                activate_protection,
                deactivate_protection,
                get_active_protections,
            )

            if args[0].lower() == "list":
                protections = await get_active_protections(session)
                if not protections:
                    await update.message.reply_text(
                        "🟢 No active protections\\.", parse_mode=ParseMode.MARKDOWN_V2
                    )
                else:
                    lines = ["🛡️ *Active Protections:*\n"]
                    for p in protections:
                        lines.append(
                            f"• {escape_md(p['muscle_group'])}: "
                            f"severity {p['severity']}/10, "
                            f"volume ×{p['factor']}"
                        )
                    await update.message.reply_text(
                        "\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2
                    )
                return

            muscle = args[0].lower()

            if len(args) > 1 and args[1].lower() == "off":
                removed = await deactivate_protection(session, muscle)
                await session.commit()
                if removed:
                    await update.message.reply_text(
                        f"✅ Protection removed for {escape_md(muscle)}\\.",
                        parse_mode=ParseMode.MARKDOWN_V2,
                    )
                else:
                    await update.message.reply_text(
                        f"No active protection for {escape_md(muscle)}\\.",
                        parse_mode=ParseMode.MARKDOWN_V2,
                    )
                return

            severity = 5
            if len(args) > 1:
                try:
                    severity = max(1, min(10, int(args[1])))
                except ValueError:
                    pass

            result = await activate_protection(session, muscle, severity)
            await session.commit()
            await update.message.reply_text(
                f"🛡️ Protection activated for *{escape_md(muscle)}*\\n"
                f"Severity: {severity}/10\\n"
                f"Volume factor: ×{result['factor']}\\n\\n"
                f"Plans will reduce volume for this muscle\\.\\n"
                f"Use `/pain {escape_md(muscle)} off` to deactivate\\.",
                parse_mode=ParseMode.MARKDOWN_V2,
            )
    except Exception:
        logger.exception("Error in /pain")
        await update.message.reply_text("❌ Error updating protection\\.", parse_mode=ParseMode.MARKDOWN_V2)


def register_handlers(app: Application) -> None:
    """Register all bot command handlers."""
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("week", cmd_week))
    app.add_handler(CommandHandler("log", cmd_log))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("swap", cmd_swap))
    app.add_handler(CommandHandler("pain", cmd_pain))

    # /log conversation
    log_conv = ConversationHandler(
        entry_points=[CommandHandler("log", cmd_log)],
        states={
            WAITING_LOG: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_log_input)
            ],
        },
        fallbacks=[CommandHandler("log", cmd_log)],
    )
    app.add_handler(log_conv)

    # /done conversation (waits for fatigue input)
    done_conv = ConversationHandler(
        entry_points=[CommandHandler("done", cmd_done)],
        states={
            WAITING_FATIGUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_fatigue_input)
            ],
        },
        fallbacks=[CommandHandler("done", cmd_done)],
    )
    app.add_handler(done_conv)

