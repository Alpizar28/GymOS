"""Application entrypoint: starts FastAPI API and Telegram bot concurrently."""

import asyncio
import contextlib
import logging
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import init_db

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

STATIC_DIR = None  # Static files now served by Next.js


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and start Telegram bot on startup."""
    await init_db()
    logger.info("Database initialized")

    # Start Telegram bot in background
    bot_task = None
    if settings.telegram_bot_token:
        bot_task = asyncio.create_task(_run_bot())
        logger.info("Telegram bot started in background")
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set — bot disabled")

    yield

    # Shutdown
    if bot_task and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass
    logger.info("Shutdown complete")


async def _run_bot() -> None:
    """Run the Telegram bot polling loop."""
    from telegram.ext import Application

    from src.bot.handlers import register_handlers

    app = Application.builder().token(settings.telegram_bot_token).build()
    register_handlers(app)

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    from src.api.routes import router

    app = FastAPI(
        title="Gym Training System",
        version="0.2.0",
        lifespan=lifespan,
    )

    # CORS for Next.js dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routes
    app.include_router(router)

    return app


app = create_app()


def main() -> None:
    """Main entry point."""
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
