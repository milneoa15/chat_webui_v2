"""Tests covering model catalog endpoints and services."""
from __future__ import annotations

from typing import Any, AsyncIterator

import httpx
import pytest
from fastapi.testclient import TestClient

from api.config import get_settings
from api.database import get_session_factory
from api.dependencies import get_model_service
from api.main import app
from api.schemas import ModelListResponse
from api.services.models import ModelService, get_model_cache


def test_model_list_includes_session_warnings() -> None:
    cache = get_model_cache()
    cache.clear()
    with TestClient(app) as client:
        cache.update(
            tags=[
                {
                    "name": "llama3",
                    "digest": "sha256:123",
                    "size": 4 * 1024 * 1024,
                    "modified_at": "2024-05-01T00:00:00Z",
                }
            ],
            processes=[],
            status="ok",
        )
        session_id = client.post("/api/sessions", json={"title": "Model Test"}).json()["id"]
        message_payload = {
            "role": "assistant",
            "content": "Hello model!",
            "model": "llama3",
        }
        client.post(f"/api/sessions/{session_id}/messages", json=message_payload)
        response = client.get("/api/models")
    assert response.status_code == 200
    payload: ModelListResponse = ModelListResponse.model_validate(response.json())
    assert payload.items
    entry = payload.items[0]
    assert entry.warnings == ["model_not_loaded"]
    assert entry.sessions == [session_id]
    cache.clear()


class _StubModelService:
    async def list_models(self) -> ModelListResponse:  # pragma: no cover - unused
        return ModelListResponse(items=[], last_refreshed=None)

    async def pull_model_stream(self, *_: Any, **__: Any) -> AsyncIterator[dict[str, Any]]:
        yield {"status": "downloading", "completed": 10}
        yield {"status": "success"}


def test_model_pull_streams_sse() -> None:
    stub = _StubModelService()
    app.dependency_overrides[get_model_service] = lambda: stub
    try:
        with TestClient(app) as client:
            with client.stream("POST", "/api/models/pull", json={"name": "llama3"}) as stream:
                lines = [line for line in stream.iter_lines() if line]
    finally:
        app.dependency_overrides.pop(get_model_service, None)
    joined = "\n".join(lines)
    assert "downloading" in joined
    assert "success" in joined


@pytest.mark.asyncio
async def test_model_service_load_unload_invokes_subprocess(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    session_factory = get_session_factory(settings)
    cache = get_model_cache()
    cache.clear()
    async with session_factory() as session:
        async with httpx.AsyncClient() as client:
            service = ModelService(session=session, settings=settings, http_client=client, cache=cache)
            calls: list[list[str]] = []

            async def _fake_run(self: ModelService, args: list[str]) -> str:
                calls.append(args)
                return "ok"

            monkeypatch.setattr(ModelService, "_run_subprocess", _fake_run)
            await service.load_model("llama3")
            await service.unload_model("llama3")
    assert calls == [
        ["ollama", "run", "llama3"],
        ["ollama", "stop", "llama3"],
    ]
