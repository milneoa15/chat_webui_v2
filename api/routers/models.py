"""Model management API routes."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..dependencies import get_model_service
from ..schemas import (
    ModelActionResponse,
    ModelListResponse,
    ModelNameRequest,
    ModelPullRequest,
)
from ..services.models import ModelService

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=ModelListResponse)
async def list_models(service: ModelService = Depends(get_model_service)) -> ModelListResponse:
    """Return cached model metadata augmented with usage warnings."""
    return await service.list_models()


@router.get("/{name}")
async def show_model(name: str, service: ModelService = Depends(get_model_service)) -> dict[str, Any]:
    """Proxy Ollama `show` endpoint."""
    return await service.show_model(name)


@router.delete("/{name}", response_model=ModelActionResponse)
async def delete_model(
    name: str, service: ModelService = Depends(get_model_service)
) -> ModelActionResponse:
    """Delete a local model via Ollama."""
    return await service.delete_model(name)


@router.post("/pull")
async def pull_model(
    payload: ModelPullRequest, service: ModelService = Depends(get_model_service)
) -> StreamingResponse:
    """Stream progress from the Ollama pull endpoint via SSE."""

    async def event_stream() -> Any:
        async for chunk in service.pull_model_stream(payload):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/load", response_model=ModelActionResponse)
async def load_model(
    payload: ModelNameRequest, service: ModelService = Depends(get_model_service)
) -> ModelActionResponse:
    """Load a model into memory using `ollama run`."""
    return await service.load_model(payload.name)


@router.post("/unload", response_model=ModelActionResponse)
async def unload_model(
    payload: ModelNameRequest, service: ModelService = Depends(get_model_service)
) -> ModelActionResponse:
    """Unload a running model using `ollama stop`."""
    return await service.unload_model(payload.name)
