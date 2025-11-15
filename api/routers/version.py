"""Ollama proxy routes."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_config_service, get_http_client
from ..schemas import ConfigRead, VersionResponse
from ..services.config import ConfigService

router = APIRouter(prefix="/api", tags=["ollama"])


@router.get("/version", response_model=VersionResponse)
async def get_version(
    service: ConfigService = Depends(get_config_service),
    client: httpx.AsyncClient = Depends(get_http_client),
) -> VersionResponse:
    """Call Ollama's /api/version endpoint for connectivity validation."""
    config: ConfigRead = await service.get_or_create()
    base_url = str(config.ollama_base_url).rstrip("/")
    url = f"{base_url}/api/version"
    try:
        response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:  # pragma: no cover - exercised via tests
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama request failed: {exc}",
        ) from exc
    data = response.json()
    version = data.get("version")
    if not version:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ollama response missing version",
        )
    return VersionResponse(version=version)
