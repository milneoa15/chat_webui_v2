"""Tests covering session CRUD, title fallback, and prompt builder behavior."""
from __future__ import annotations

from typing import Any

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from api.config import get_settings
from api.database import get_session_factory
from api.dependencies import get_title_service
from api.main import app
from api.models import MessageRole
from api.services.prompt_builder import PromptBuilder, PromptFragment
from api.services.title import TitleService


class _StubTitleService:
    def __init__(self) -> None:
        self.payload: dict[str, Any] | None = None

    def queue_title_generation(self, session_id: int, prompt: str, model: str | None = None) -> None:
        self.payload = {"session_id": session_id, "prompt": prompt, "model": model}


def test_session_crud_and_messages() -> None:
    stub = _StubTitleService()
    app.dependency_overrides[get_title_service] = lambda: stub
    try:
        with TestClient(app) as client:
            create_resp = client.post("/api/sessions", json={})
            assert create_resp.status_code == 201
            session_id = create_resp.json()["id"]

            list_resp = client.get("/api/sessions")
            assert list_resp.status_code == 200
            assert any(item["id"] == session_id for item in list_resp.json()["items"])

            message_payload = {
                "role": "user",
                "content": "Hello from pytest",
                "model": "llama3",
                "prompt_tokens": 4,
                "completion_tokens": 0,
                "total_tokens": 4,
                "metrics": {"latency_ms": 10},
            }
            create_msg = client.post(f"/api/sessions/{session_id}/messages", json=message_payload)
            assert create_msg.status_code == 201

            msg_list = client.get(f"/api/sessions/{session_id}/messages")
            assert msg_list.status_code == 200
            payload = msg_list.json()
            assert payload["total"] == 1
            assert payload["items"][0]["content"] == "Hello from pytest"

            rename_resp = client.patch(f"/api/sessions/{session_id}", json={"title": "Renamed"})
            assert rename_resp.status_code == 200
            assert rename_resp.json()["title"] == "Renamed"

            delete_resp = client.delete(f"/api/sessions/{session_id}")
            assert delete_resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_title_service, None)
    assert stub.payload is not None
    assert stub.payload["prompt"] == "Hello from pytest"


@pytest.mark.asyncio
async def test_title_generation_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    with TestClient(app) as client:
        session_id = client.post("/api/sessions", json={"title": "Placeholder"}).json()["id"]

    async def _raise_http_error(self: httpx.AsyncClient, *_: Any, **__: Any) -> httpx.Response:
        raise httpx.HTTPError("unavailable")

    monkeypatch.setattr(httpx.AsyncClient, "post", _raise_http_error)

    settings = get_settings()
    session_factory = get_session_factory(settings)
    fernet = Fernet(settings.fernet_key.encode("utf-8"))
    title_service = TitleService(session_factory=session_factory, settings=settings, fernet=fernet)

    title = await title_service.generate_title(session_id, prompt="need fallback title")
    assert title == "Need Fallback Title"

    with TestClient(app) as client:
        sessions = client.get("/api/sessions").json()["items"]
    assert any(item["id"] == session_id and item["title"] == "Need Fallback Title" for item in sessions)


def test_prompt_builder_orders_plugins() -> None:
    builder = PromptBuilder()
    base = [
        PromptFragment(role=MessageRole.SYSTEM, content="base system", priority=0),
        PromptFragment(role=MessageRole.USER, content="base user", priority=1),
    ]
    plugins = [
        PromptFragment(
            role=MessageRole.ASSISTANT, content="plugin two", source="rag", priority=5
        ),
        PromptFragment(
            role=MessageRole.ASSISTANT, content="plugin one", source="search", priority=2
        ),
    ]
    prompt = builder.build(base, plugins)
    assert [fragment.content for fragment in prompt] == [
        "base system",
        "base user",
        "plugin one",
        "plugin two",
    ]
    serialized = builder.serialize(prompt)
    assert serialized[0]["role"] == "system"
    assert serialized[-1]["content"] == "plugin two"
