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
from ..models import Config
from ..schemas import HealthResponse

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
    uptime_seconds = (datetime.now(timezone.utc) - START_TIME).total_seconds()
    status_value: Literal["ok", "degraded", "error"] = "ok" if db_status == "ok" else "degraded"
    return HealthResponse(
        status=status_value,
        db_status=db_status,
        uptime_seconds=uptime_seconds,
        timestamp=datetime.now(timezone.utc),
        version=settings.app_version,
    )
