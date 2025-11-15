"""FastAPI application entry point for Chatbot Web UI v2."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Awaitable, Callable

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import AppSettings, get_settings
from .database import dispose_engine, init_db
from .routers import config as config_router
from .routers import health as health_router
from .routers import version as version_router


def configure_logging(settings: AppSettings) -> None:
    """Configure structlog + stdlib logging."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=log_level, format="%(message)s")
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.EventRenamer("message"),
            structlog.processors.JSONRenderer(),
        ],
        cache_logger_on_first_use=True,
    )


settings = get_settings()
configure_logging(settings)
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Run startup/shutdown hooks via FastAPI lifespan API."""
    await init_db()
    logger.info("app.startup_complete")
    try:
        yield
    finally:
        await dispose_engine()
        logger.info("app.shutdown_complete")


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def envelope_errors(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Ensure unexpected exceptions render as JSON envelopes."""
    try:
        return await call_next(request)
    except HTTPException as exc:
        payload: dict[str, Any]
        if isinstance(exc.detail, dict):
            payload = exc.detail
        else:
            payload = {"message": str(exc.detail)}
        logger.warning(
            "http_exception",
            path=request.url.path,
            status_code=exc.status_code,
            detail=payload,
        )
        return JSONResponse(
            status_code=exc.status_code, content={"error": payload, "status": "error"}
        )
    except Exception:  # pragma: no cover - defensive
        logger.exception("unhandled_exception", path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": {"message": "Internal server error"}, "status": "error"},
        )


app.include_router(health_router.router)
app.include_router(config_router.router)
app.include_router(version_router.router)
