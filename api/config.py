"""Application configuration powered by pydantic-settings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import cast

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class AppSettings(BaseSettings):
    """Central application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Chatbot Web UI v2"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"
    backend_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    database_url: str | None = None
    database_path: Path = BASE_DIR / "chatbot.db"

    fernet_key: str = Field(default="")
    ollama_base_url: AnyHttpUrl = Field(
        default_factory=lambda: cast(AnyHttpUrl, "http://127.0.0.1:11434")
    )
    ollama_timeout_seconds: float = 15.0

    default_model: str = "llama3"
    default_temperature: float = 0.7
    default_top_p: float = 0.9
    default_max_tokens: int | None = 512
    default_top_k: int | None = None
    default_repeat_penalty: float | None = None
    default_context_window: int | None = None
    default_stop_sequences: list[str] = Field(default_factory=list)
    default_theme: str = "system"

    sse_buffer_limit: int = 1024
    scheduler_poll_seconds: int = 60
    scheduler_heartbeat_seconds: int = 30

    @property
    def resolved_database_url(self) -> str:  # pragma: no cover - thin wrapper
        """Return the database URL, building a SQLite path when not provided."""
        if self.database_url:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.database_path}"


@lru_cache
def get_settings() -> AppSettings:
    """Return cached settings loaded from the environment."""
    settings = AppSettings()
    if not settings.fernet_key:
        # Generate per-process key for local development when none is provided
        from cryptography.fernet import Fernet

        settings.fernet_key = Fernet.generate_key().decode("utf-8")
    return settings
