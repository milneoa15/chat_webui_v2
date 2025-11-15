"""Configuration CRUD routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from ..dependencies import get_config_service
from ..schemas import ConfigCreate, ConfigRead, ConfigUpdate
from ..services.config import ConfigService

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigRead)
async def read_config(service: ConfigService = Depends(get_config_service)) -> ConfigRead:
    """Return the persisted configuration (creates defaults if absent)."""
    return await service.get_or_create()


@router.post("", response_model=ConfigRead, status_code=status.HTTP_201_CREATED)
async def create_config(
    payload: ConfigCreate, service: ConfigService = Depends(get_config_service)
) -> ConfigRead:
    """Create the configuration entry when it does not yet exist."""
    return await service.create(payload)


@router.put("", response_model=ConfigRead)
async def update_config(
    payload: ConfigUpdate, service: ConfigService = Depends(get_config_service)
) -> ConfigRead:
    """Update persisted configuration."""
    return await service.update(payload)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(service: ConfigService = Depends(get_config_service)) -> Response:
    """Delete the existing configuration entry."""
    await service.delete()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
