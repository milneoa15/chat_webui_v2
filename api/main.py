"""FastAPI application entry point for Chatbot Web UI v2."""
from fastapi import FastAPI

app = FastAPI(title="Chatbot Web UI v2")


@app.get("/api/health")
def health() -> dict[str, str]:
    """Basic placeholder health endpoint for CI scaffolding."""
    return {"status": "ok"}
