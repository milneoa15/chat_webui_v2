from fastapi.testclient import TestClient

from api.main import app


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["db_status"] == "ok"
    assert payload["version"] == app.version
    assert payload["uptime_seconds"] >= 0
