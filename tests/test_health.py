from fastapi.testclient import TestClient

from api.main import app


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ok", "degraded"}
    assert payload["db_status"] == "ok"
    assert payload["ollama_status"] in {"unknown", "ok", "error"}
    assert payload["scheduler_status"] in {"running", "stopped", "error"}
    assert "model_cache_age_seconds" in payload
    assert "cached_model_count" in payload
    assert "model_stats" in payload
    assert payload["version"] == app.version
    assert payload["uptime_seconds"] >= 0
