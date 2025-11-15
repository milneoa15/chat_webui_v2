"""SQLModel ORM models."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column
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


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Session(SQLModel, table=True):
    """Chat session entity tracked for message history."""

    __tablename__ = "sessions"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(default="New Chat", max_length=120, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Message(SQLModel, table=True):
    """Chat message persisted per session."""

    __tablename__ = "messages"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="sessions.id", index=True)
    role: MessageRole = Field(default=MessageRole.USER)
    content: str = Field(min_length=1)
    model: str | None = Field(default=None)
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    metrics: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, default=dict),
    )
    created_at: datetime = Field(default_factory=utcnow)


class PromptMeta(SQLModel, table=True):
    """Metadata emitted by the prompt builder for analytics."""

    __tablename__ = "prompt_meta"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="sessions.id", index=True)
    model: str = Field(default="llama3")
    author_role: MessageRole = Field(default=MessageRole.SYSTEM)
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    plugin_trace: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, default=dict),
    )
    created_at: datetime = Field(default_factory=utcnow)


class SessionModelLink(SQLModel, table=True):
    """Track which sessions reference which models for warning surfaces."""

    __tablename__ = "session_models"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="sessions.id", index=True)
    model_name: str = Field(max_length=120, index=True)
    last_used_at: datetime = Field(default_factory=utcnow)


class ModelStatsSnapshot(SQLModel, table=True):
    """Persisted snapshot of CPU/GPU metrics gathered from Ollama."""

    __tablename__ = "model_stats"

    id: int | None = Field(default=None, primary_key=True)
    cpu_percent: float | None = Field(default=None, ge=0)
    gpu_percent: float | None = Field(default=None, ge=0)
    memory_percent: float | None = Field(default=None, ge=0)
    raw: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, default=dict),
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
