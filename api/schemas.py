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
    top_k: int | None = Field(default=None, ge=1)
    repeat_penalty: float | None = Field(default=None, ge=0.0)
    context_window: int | None = Field(default=None, ge=1)
    stop: list[str] = Field(default_factory=list)


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
    is_pinned: bool = False


class MessageRead(MessageCreate):
    """Response schema for stored messages."""

    id: int
    session_id: int
    created_at: datetime


class MessagePinRequest(BaseModel):
    """Toggle a message pin flag."""

    pinned: bool = Field(default=True)


class PromptOptions(BaseModel):
    """Per-request overrides for generation parameters."""

    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1)
    repeat_penalty: float | None = Field(default=None, ge=0.0)
    context_window: int | None = Field(default=None, ge=1)
    max_tokens: int | None = Field(default=None, ge=1)
    stop: list[str] | None = None


class ChatRequest(BaseModel):
    """Request body for the streaming chat endpoint."""

    session_id: int
    prompt: str | None = Field(default=None, min_length=1)
    model: str | None = None
    system_prompt: str | None = None
    options: PromptOptions | None = None
    regenerate_message_id: int | None = Field(default=None, ge=1)


class ChatChunkEvent(BaseModel):
    """Emitted for each streamed chunk."""

    type: Literal["chunk"] = "chunk"
    delta: str
    content: str


class ChatCompletionEvent(BaseModel):
    """Emitted after Ollama completes the generation."""

    type: Literal["complete"] = "complete"
    message_id: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class ChatStatusEvent(BaseModel):
    """General status updates sent to the SSE client."""

    type: Literal["status"] = "status"
    message: str


class ChatHeartbeatEvent(BaseModel):
    """Periodic heartbeat event to keep the SSE connection alive."""

    type: Literal["heartbeat"] = "heartbeat"
    timestamp: datetime


class ChatErrorEvent(BaseModel):
    """Error event emitted before terminating the stream."""

    type: Literal["error"] = "error"
    message: str


class MessageRegenerateResponse(BaseModel):
    """Response payload containing data to trigger regeneration."""

    session_id: int
    assistant_message_id: int
    prompt: str
    model: str | None = None


class MessageMetrics(BaseModel):
    """Per-message token metrics."""

    message_id: int
    role: MessageRoleLiteral
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    metrics: dict[str, Any] = Field(default_factory=dict)


class SessionMetricsResponse(BaseModel):
    """Aggregated metrics for a session."""

    session_id: int
    total_prompt_tokens: int = Field(default=0, ge=0)
    total_completion_tokens: int = Field(default=0, ge=0)
    total_messages: int = Field(default=0, ge=0)
    messages: list[MessageMetrics]


class MessageListResponse(BaseModel):
    """Wrapper for paginated message retrieval."""

    items: list[MessageRead]
    total: int
    limit: int
    offset: int


class ModelStats(BaseModel):
    """CPU/GPU snapshot values captured during scheduler runs."""

    cpu_percent: float | None = Field(default=None, ge=0)
    gpu_percent: float | None = Field(default=None, ge=0)
    memory_percent: float | None = Field(default=None, ge=0)
    updated_at: datetime | None = None


class ModelSummary(BaseModel):
    """Aggregated metadata for a single Ollama model."""

    name: str
    digest: str | None = None
    size_mib: float | None = Field(default=None, ge=0)
    pulled: bool = False
    loaded: bool = False
    last_modified: datetime | None = None
    status: str | None = None
    sessions: list[int] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ModelListResponse(BaseModel):
    """Envelope describing cached models and scheduler stats."""

    items: list[ModelSummary]
    last_refreshed: datetime | None
    stats: ModelStats | None = None


class ModelNameRequest(BaseModel):
    """Common payload for model actions."""

    name: str = Field(min_length=1)


class ModelPullRequest(ModelNameRequest):
    """Pull request payload controlling stream behavior."""

    stream: bool = Field(default=True)


class ModelActionResponse(BaseModel):
    """Standard response when performing model actions."""

    name: str
    message: str
    timestamp: datetime


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
    ollama_status: Literal["ok", "error", "unknown"]
    scheduler_status: Literal["running", "stopped", "error"]
    model_cache_age_seconds: float | None = Field(default=None, ge=0)
    cached_model_count: int = Field(default=0, ge=0)
    model_stats: ModelStats | None = None
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
