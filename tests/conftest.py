"""Pytest configuration for backend tests."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Generator

import pytest
from cryptography.fernet import Fernet

from api.config import get_settings
from api.database import dispose_engine


@pytest.fixture(scope="session", autouse=True)
def configure_test_env(tmp_path_factory: pytest.TempPathFactory) -> Generator[None, None, None]:
    """Point the backend at a throwaway SQLite database for tests."""
    db_dir = tmp_path_factory.mktemp("db")
    db_path = Path(db_dir) / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    os.environ["FERNET_KEY"] = Fernet.generate_key().decode("utf-8")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
    asyncio.run(dispose_engine())
