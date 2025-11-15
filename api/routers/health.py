"""Health check endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import AppSettings, get_settings
from ..dependencies import get_db_session
from ..models import Config, ModelStatsSnapshot
from ..schemas import HealthResponse, ModelStats
from ..services.models import get_model_cache

router = APIRouter(prefix="/api", tags=["health"])
logger = structlog.get_logger(__name__)
START_TIME = datetime.now(timezone.utc)


@router.get("/health", response_model=HealthResponse)
async def health(
    session: AsyncSession = Depends(get_db_session),
    settings: AppSettings = Depends(get_settings),
) -> HealthResponse:
    """Return API readiness information including DB status and uptime."""
    db_status: Literal["ok", "error"] = "ok"
    try:
        await session.exec(select(Config.id).limit(1))
    except SQLAlchemyError:
        logger.exception("health.database_error")
        db_status = "error"
    now = datetime.now(timezone.utc)
    uptime_seconds = (now - START_TIME).total_seconds()
    cache = get_model_cache().snapshot()
    cache_age = (now - cache.last_refresh).total_seconds() if cache.last_refresh else None
    stats_row = await session.get(ModelStatsSnapshot, 1)
    stats_payload = (
        ModelStats(
            cpu_percent=stats_row.cpu_percent,
            gpu_percent=stats_row.gpu_percent,
            memory_percent=stats_row.memory_percent,
            updated_at=stats_row.updated_at,
        )
        if stats_row
        else None
    )
    status_value: Literal["ok", "degraded", "error"] = "ok"
    if db_status == "error" or cache.ollama_status == "error":
        status_value = "degraded"
    if db_status == "error" and cache.ollama_status == "error":
        status_value = "error"
    return HealthResponse(
        status=status_value,
        db_status=db_status,
        ollama_status=cache.ollama_status,
        scheduler_status=cache.scheduler_state,
        model_cache_age_seconds=cache_age,
        cached_model_count=len(cache.tags),
        model_stats=stats_payload,
        uptime_seconds=uptime_seconds,
        timestamp=now,
        version=settings.app_version,
    )
