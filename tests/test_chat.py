"""Tests covering the chat streaming SSE endpoint and metrics aggregation."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi.testclient import TestClient

from api.dependencies import get_http_client
from api.main import app


class _MockStream:
    def __init__(self, lines: list[str]) -> None:
        self.lines = lines

    async def __aenter__(self) -> "_MockStream":
        return self

    async def __aexit__(self, *_: Any) -> None:
        return None

    def raise_for_status(self) -> None:
        return None

    async def aiter_lines(self) -> AsyncIterator[str]:
        for line in self.lines:
            yield line


class _MockHTTPClient:
    def __init__(self, lines: list[str]) -> None:
        self.lines = lines
        self.last_payload: dict[str, Any] | None = None

    def stream(self, method: str, url: str, json: dict[str, Any]) -> _MockStream:
        assert method == "POST"
        self.last_payload = {"url": url, "json": json}
        return _MockStream(self.lines)


def test_chat_streams_and_persists_metrics() -> None:
    chunks = [
        json.dumps({"response": "Hello", "done": False}),
        json.dumps({"response": " world", "done": False}),
        json.dumps(
            {
                "response": "",
                "done": True,
                "eval_count": 5,
                "prompt_eval_count": 2,
                "eval_duration": 2_000_000_000,
                "total_duration": 3_000_000_000,
            }
        ),
    ]
    client_stub = _MockHTTPClient(chunks)

    async def _override_http_client() -> AsyncIterator[_MockHTTPClient]:
        yield client_stub

    app.dependency_overrides[get_http_client] = _override_http_client
    try:
        with TestClient(app) as client:
            session_id = client.post("/api/sessions", json={"title": "Stream"}).json()["id"]
            payload = {"session_id": session_id, "prompt": "Hi there", "model": "codex-test"}
            events: list[dict[str, Any]] = []
            with client.stream("POST", "/api/chat", json=payload) as response:
                assert response.status_code == 200
                for line in response.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    event_payload = json.loads(line.split("data: ", 1)[1])
                    events.append(event_payload)

            assert any(event["type"] == "chunk" for event in events)
            assert events[-1]["type"] == "complete"
            assert client_stub.last_payload is not None
            assert client_stub.last_payload["json"]["options"]["temperature"] is not None

            messages = client.get(f"/api/sessions/{session_id}/messages").json()["items"]
            assert len(messages) == 2  # user + assistant
            assistant = messages[-1]
            assert assistant["role"] == "assistant"
            assert assistant["metrics"]["tokens_per_second"] > 0

            metrics = client.get(f"/api/sessions/{session_id}/metrics").json()
            assert metrics["total_completion_tokens"] == 5
            assert metrics["messages"][-1]["total_tokens"] >= 5
    finally:
        app.dependency_overrides.pop(get_http_client, None)
