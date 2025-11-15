"""Pydantic schemas shared across routers."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

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
