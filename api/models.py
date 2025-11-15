"""SQLModel ORM models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Config(SQLModel, table=True):
    """Persisted configuration for Ollama connection and UI settings."""

    __tablename__ = "config"

    id: int | None = Field(default=None, primary_key=True)
    ollama_base_url_encrypted: str
    default_model: str
    temperature: float = Field(default=0.7)
    top_p: float = Field(default=0.9)
    max_tokens: int | None = Field(default=None)
    theme: str = Field(default="system")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
