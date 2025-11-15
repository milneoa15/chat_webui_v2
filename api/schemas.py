"""Pydantic schemas shared across routers."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import AnyHttpUrl, BaseModel, Field


class GenerationDefaults(BaseModel):
    """Model generation default values."""

    model: str = Field(default="llama3", min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    max_tokens: int | None = Field(default=None, ge=1)


class ConfigBase(BaseModel):
    """Common config fields shared between create/update schemas."""

    ollama_base_url: AnyHttpUrl
    generation_defaults: GenerationDefaults = Field(default_factory=lambda: GenerationDefaults())
    theme: str = Field(default="system", pattern="^(system|light|dark)$")


class ConfigCreate(ConfigBase):
    """Schema used for creating configuration entries."""


class ConfigUpdate(BaseModel):
    """Schema for partial configuration updates."""

    ollama_base_url: AnyHttpUrl | None = None
    generation_defaults: GenerationDefaults | None = None
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")


class ConfigRead(ConfigBase):
    """Response schema for persisted configuration."""

    id: int
    created_at: datetime
    updated_at: datetime


MessageRoleLiteral = Literal["system", "user", "assistant", "tool"]


class SessionCreate(BaseModel):
    """Payload for creating sessions."""

    title: str | None = Field(default=None, max_length=120)


class SessionUpdate(BaseModel):
    """Payload for updating session properties."""

    title: str = Field(max_length=120, min_length=1)


class SessionRead(BaseModel):
    """Session representation."""

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    """Envelope for paginated session listings (simple list wrapper)."""

    items: list[SessionRead]


class MessageCreate(BaseModel):
    """Payload for persisting chat messages."""

    role: MessageRoleLiteral
    content: str = Field(min_length=1)
    model: str | None = Field(default=None)
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    metrics: dict[str, Any] = Field(default_factory=dict)


class MessageRead(MessageCreate):
    """Response schema for stored messages."""

    id: int
    session_id: int
    created_at: datetime


class MessageListResponse(BaseModel):
    """Wrapper for paginated message retrieval."""

    items: list[MessageRead]
    total: int
    limit: int
    offset: int


class TitleRequest(BaseModel):
    """Request body for title generation."""

    session_id: int
    prompt: str = Field(min_length=1)
    model: str | None = None


class TitleResponse(BaseModel):
    """Response from title generation endpoint."""

    session_id: int
    title: str


class HealthResponse(BaseModel):
    """Health endpoint response."""

    status: Literal["ok", "degraded", "error"]
    db_status: Literal["ok", "error"]
    uptime_seconds: float = Field(ge=0)
    timestamp: datetime
    version: str


class VersionResponse(BaseModel):
    """Proxy response for Ollama version."""

    version: str


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    error: str
    message: str
