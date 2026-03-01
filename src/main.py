"""Application entrypoint: starts FastAPI API and Telegram bot in webhook mode."""

import asyncio
import contextlib
import logging
import sys

import uvicorn
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Shared bot application instance (used by webhook endpoint)
_bot_app = None


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and configure Telegram webhook on startup."""
    from src.database import init_db

    await init_db()
    logger.info("Database initialized")

    if settings.telegram_bot_token:
        await _setup_webhook()
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set — bot disabled")

    yield

    # Teardown: delete webhook on shutdown
    if settings.telegram_bot_token and _bot_app:
        try:
            await _bot_app.updater.stop()
            await _bot_app.stop()
            await _bot_app.shutdown()
            logger.info("Bot webhook teardown complete")
        except Exception:
            logger.exception("Error during bot shutdown")

    logger.info("Shutdown complete")


async def _setup_webhook() -> None:
    """Initialize PTB application and register the Telegram webhook URL."""
    global _bot_app

    from telegram.ext import Application

    from src.bot.handlers import register_handlers

    if not settings.webhook_url:
        # Fallback to polling if no webhook URL configured
        logger.warning(
            "WEBHOOK_URL not set — falling back to polling mode (not recommended for production)"
        )
        asyncio.create_task(_run_polling())
        return

    webhook_path = f"/telegram/webhook/{settings.telegram_bot_token}"
    full_webhook_url = f"{settings.webhook_url.rstrip('/')}{webhook_path}"

    _bot_app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .updater(None)         # Disable built-in polling updater; we handle updates manually
        .build()
    )
    register_handlers(_bot_app)
    await _bot_app.initialize()
    await _bot_app.start()

    # Register webhook with Telegram
    await _bot_app.bot.set_webhook(
        url=full_webhook_url,
        allowed_updates=["message", "callback_query"],
        drop_pending_updates=True,
    )
    logger.info("Telegram webhook registered: %s", full_webhook_url)


async def _run_polling() -> None:
    """Polling fallback for local development."""
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
        title="GymOS",
        version="0.3.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.log_level.upper() == "DEBUG" else None,
        redoc_url=None,
    )

    # CORS — allow Next.js frontend and Coolify-generated domain
    allowed_origins = ["http://localhost:3000"]
    if settings.web_url:
        allowed_origins.append(settings.web_url.rstrip("/"))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Telegram webhook receiver
    @app.post(
        f"/telegram/webhook/{settings.telegram_bot_token}",
        include_in_schema=False,  # Hide from public docs
        status_code=status.HTTP_200_OK,
    )
    async def telegram_webhook(request: Request) -> Response:
        """Receive Telegram updates via webhook and pass to PTB application."""
        if _bot_app is None:
            return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        from telegram import Update

        data = await request.json()
        update = Update.de_json(data, _bot_app.bot)
        await _bot_app.process_update(update)
        return Response(status_code=status.HTTP_200_OK)

    # API routes
    app.include_router(router)

    return app


app = create_app()


def main() -> None:
    """Main entry point — Uvicorn serves both API and webhook endpoint."""
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(settings.port),
        reload=False,
        log_level=settings.log_level.lower(),
        proxy_headers=True,         # Trust X-Forwarded-* from NGINX/Coolify proxy
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
