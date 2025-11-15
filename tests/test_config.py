"""Tests covering configuration CRUD and Ollama proxy validation."""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi.testclient import TestClient

from api.dependencies import get_http_client
from api.main import app


def _sample_payload() -> dict[str, Any]:
    return {
        "ollama_base_url": "http://localhost:11434",
        "generation_defaults": {
            "model": "llama3",
            "temperature": 0.65,
            "top_p": 0.8,
            "max_tokens": 256,
        },
        "theme": "dark",
    }


def test_update_config_round_trip() -> None:
    with TestClient(app) as client:
        # Prime default config
        client.get("/api/config")
        response = client.put("/api/config", json=_sample_payload())
    assert response.status_code == 200
    payload = response.json()
    assert payload["theme"] == "dark"
    assert payload["ollama_base_url"].rstrip("/") == "http://localhost:11434"
    assert payload["generation_defaults"]["max_tokens"] == 256


def test_version_proxy_uses_mock_transport() -> None:
    async def _mock_http_client() -> AsyncIterator[httpx.AsyncClient]:
        def _handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/version"
            return httpx.Response(200, json={"version": "1.2.3"})

        transport = httpx.MockTransport(_handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://mockserver") as client:
            yield client

    app.dependency_overrides[get_http_client] = _mock_http_client
    try:
        with TestClient(app) as client:
            client.get("/api/config")  # ensure config row exists
            response = client.get("/api/version")
    finally:
        app.dependency_overrides.pop(get_http_client, None)
    assert response.status_code == 200
    assert response.json() == {"version": "1.2.3"}
