"""Application entrypoint: FastAPI + GymOS backend (web-only mode)."""

import logging
import sys

import uvicorn
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.auth import authenticate_request, clear_current_user_id
from src.config import settings
from src.database import async_session
from src.services.user_bootstrap import ensure_user_bootstrap

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


import contextlib


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    from src.database import init_db

    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    from src.api.routes import router

    app = FastAPI(
        title="GymOS",
        version="0.4.0",
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
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def auth_context_middleware(request, call_next):
        try:
            user = authenticate_request(request)
            if user.user_id != "system":
                async with async_session() as session:
                    await ensure_user_bootstrap(session, user.user_id)
            response = await call_next(request)
            return response
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        finally:
            clear_current_user_id()

    app.include_router(router)
    return app


app = create_app()


def main() -> None:
    """Main entry point — Uvicorn serves the API."""
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(settings.port),
        reload=False,
        log_level=settings.log_level.lower(),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
