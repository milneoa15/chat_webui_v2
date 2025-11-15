"""Model management services, cache, and scheduler integration."""
from __future__ import annotations

import asyncio
import json
import subprocess
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, cast

import httpx
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..config import AppSettings
from ..models import ModelStatsSnapshot, SessionModelLink
from ..schemas import (
    ModelActionResponse,
    ModelListResponse,
    ModelPullRequest,
    ModelStats,
    ModelSummary,
)

logger = structlog.get_logger(__name__)

OllamaStatus = Literal["unknown", "ok", "error"]
SchedulerState = Literal["stopped", "running", "error"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ModelCacheState:
    tags: list[dict[str, Any]] = field(default_factory=list)
    processes: list[dict[str, Any]] = field(default_factory=list)
    last_refresh: datetime | None = None
    last_error: str | None = None
    ollama_status: OllamaStatus = "unknown"
    scheduler_state: SchedulerState = "stopped"


@dataclass
class ModelCacheStore(ModelCacheState):
    """In-memory cache mutated by scheduler and services."""

    def snapshot(self) -> ModelCacheState:
        return ModelCacheState(
            tags=list(self.tags),
            processes=list(self.processes),
            last_refresh=self.last_refresh,
            last_error=self.last_error,
            ollama_status=self.ollama_status,
            scheduler_state=self.scheduler_state,
        )

    def update(
        self,
        *,
        tags: list[dict[str, Any]],
        processes: list[dict[str, Any]],
        status: OllamaStatus = "ok",
    ) -> None:
        self.tags = list(tags)
        self.processes = list(processes)
        self.last_refresh = _utcnow()
        self.ollama_status = status
        self.last_error = None

    def mark_error(self, error: str) -> None:
        self.last_error = error
        self.ollama_status = "error"

    def mark_scheduler(self, state: SchedulerState) -> None:
        self.scheduler_state = state

    def clear(self) -> None:
        self.tags = []
        self.processes = []
        self.last_refresh = None
        self.last_error = None
        self.ollama_status = "unknown"


model_cache = ModelCacheStore()


def get_model_cache() -> ModelCacheStore:
    """Return the singleton model cache store."""
    return model_cache


async def _request_model_lists(
    client: httpx.AsyncClient, base_url: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    tags_resp = await client.get(f"{base_url}/api/tags")
    tags_resp.raise_for_status()
    ps_resp = await client.get(f"{base_url}/api/ps")
    ps_resp.raise_for_status()
    tags = tags_resp.json().get("models", [])
    processes = ps_resp.json().get("models", [])
    return tags, processes


def _aggregate_process_stats(processes: Sequence[dict[str, Any]]) -> tuple[float | None, float | None, float | None]:
    cpu_values: list[float] = []
    gpu_values: list[float] = []
    memory_values: list[float] = []
    for process in processes:
        stats = process.get("stats") or {}
        cpu = stats.get("cpu")
        gpu = stats.get("gpu")
        mem = stats.get("memory")
        if isinstance(cpu, (int, float)):
            cpu_values.append(float(cpu))
        if isinstance(gpu, (int, float)):
            gpu_values.append(float(gpu))
        if isinstance(mem, (int, float)):
            memory_values.append(float(mem))
    def _average(values: Sequence[float]) -> float | None:
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    return _average(cpu_values), _average(gpu_values), _average(memory_values)


async def persist_process_stats(
    session: AsyncSession, processes: Sequence[dict[str, Any]]
) -> ModelStatsSnapshot:
    cpu, gpu, memory = _aggregate_process_stats(processes)
    stats = await session.get(ModelStatsSnapshot, 1)
    if stats is None:
        stats = ModelStatsSnapshot(id=1)
    stats.cpu_percent = cpu
    stats.gpu_percent = gpu
    stats.memory_percent = memory
    stats.raw = {"processes": processes}
    stats.updated_at = _utcnow()
    session.add(stats)
    await session.commit()
    await session.refresh(stats)
    return stats


class ModelService:
    """Proxy Ollama management endpoints and aggregate metadata."""

    def __init__(
        self,
        *,
        session: AsyncSession,
        settings: AppSettings,
        http_client: httpx.AsyncClient,
        cache: ModelCacheStore | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self.http_client = http_client
        self.cache = cache or model_cache

    def _base_url(self) -> str:
        return str(self.settings.ollama_base_url).rstrip("/")

    async def list_models(self) -> ModelListResponse:
        cache_snapshot = self.cache.snapshot()
        usage_map = await self._usage_map()
        summaries = self._build_summaries(cache_snapshot, usage_map)
        stats = await self.session.get(ModelStatsSnapshot, 1)
        stats_payload = (
            ModelStats(
                cpu_percent=stats.cpu_percent,
                gpu_percent=stats.gpu_percent,
                memory_percent=stats.memory_percent,
                updated_at=stats.updated_at,
            )
            if stats
            else None
        )
        return ModelListResponse(
            items=summaries,
            last_refreshed=cache_snapshot.last_refresh,
            stats=stats_payload,
        )

    async def show_model(self, name: str) -> dict[str, Any]:
        payload = {"name": name}
        response = await self.http_client.post(f"{self._base_url()}/api/show", json=payload)
        if response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=response.text)
        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Malformed response")
        return cast(dict[str, Any], data)

    async def delete_model(self, name: str) -> ModelActionResponse:
        payload = {"name": name}
        response = await self.http_client.request(
            "DELETE", f"{self._base_url()}/api/delete", json=payload
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=response.text)
        self.cache.clear()
        return ModelActionResponse(
            name=name,
            message=f"Deleted model {name}",
            timestamp=_utcnow(),
        )

    async def pull_model_stream(self, request: ModelPullRequest) -> AsyncIterator[dict[str, Any]]:
        payload = {"name": request.name, "stream": request.stream}
        try:
            async with self.http_client.stream(
                "POST", f"{self._base_url()}/api/pull", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        data = {"status": "message", "detail": line}
                    yield data
        except httpx.HTTPError as exc:  # pragma: no cover - defensive
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            ) from exc

    async def load_model(self, name: str) -> ModelActionResponse:
        output = await self._run_subprocess(["ollama", "run", name])
        self.cache.clear()
        return ModelActionResponse(name=name, message=output or "Model loaded", timestamp=_utcnow())

    async def unload_model(self, name: str) -> ModelActionResponse:
        output = await self._run_subprocess(["ollama", "stop", name])
        self.cache.clear()
        return ModelActionResponse(name=name, message=output or "Model stopped", timestamp=_utcnow())

    async def refresh_cache(self) -> None:
        base_url = self._base_url()
        try:
            tags, processes = await _request_model_lists(self.http_client, base_url)
        except httpx.HTTPError as exc:
            self.cache.mark_error(str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach Ollama"
            ) from exc
        await persist_process_stats(self.session, processes)
        self.cache.update(tags=tags, processes=processes)

    async def _usage_map(self) -> dict[str, list[int]]:
        statement = select(SessionModelLink)
        result = await self.session.exec(statement)
        rows = result.all()
        mapping: dict[str, list[int]] = {}
        for row in rows:
            mapping.setdefault(row.model_name, [])
            if row.session_id not in mapping[row.model_name]:
                mapping[row.model_name].append(row.session_id)
        return mapping

    def _build_summaries(
        self, cache: ModelCacheState, usage_map: dict[str, list[int]]
    ) -> list[ModelSummary]:
        tag_map: dict[str, dict[str, Any]] = {}
        for tag_payload in cache.tags:
            name = self._model_name(tag_payload)
            if not name:
                continue
            tag_map[name] = tag_payload
        process_map: dict[str, dict[str, Any]] = {}
        for process_payload in cache.processes:
            name = self._model_name(process_payload)
            if not name:
                continue
            process_map[name] = process_payload
        names = sorted(set(tag_map) | set(process_map) | set(usage_map))
        summaries: list[ModelSummary] = []
        for name in names:
            tag: dict[str, Any] | None = tag_map.get(name)
            process: dict[str, Any] | None = process_map.get(name)
            digest = None
            size_mib = None
            last_modified = None
            status_value = None
            if tag:
                digest = tag.get("digest")
                size = tag.get("size")
                if isinstance(size, (int, float)):
                    size_mib = round(float(size) / (1024 * 1024), 2)
                last_modified = self._parse_datetime(tag.get("modified_at"))
                status_value = tag.get("status") or status_value
            if process:
                digest = digest or process.get("digest")
                stats = process.get("stats") or {}
                status_value = stats.get("state") or process.get("state") or status_value
            sessions = usage_map.get(name, [])
            warnings: list[str] = []
            if sessions and process is None:
                warnings.append("model_not_loaded")
            summaries.append(
                ModelSummary(
                    name=name,
                    digest=digest,
                    size_mib=size_mib,
                    pulled=tag is not None,
                    loaded=process is not None,
                    last_modified=last_modified,
                    status=status_value,
                    sessions=sessions,
                    warnings=warnings,
                )
            )
        return summaries

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if not isinstance(value, str):
            return None
        candidate = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            return None

    @staticmethod
    def _model_name(payload: dict[str, Any] | None) -> str | None:
        if not payload:
            return None
        for key in ("name", "model"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value
        return None

    async def _run_subprocess(self, args: list[str]) -> str:
        def _execute() -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                args,
                capture_output=True,
                check=True,
                text=True,
                stdin=subprocess.DEVNULL,
                timeout=self.settings.ollama_timeout_seconds,
            )

        try:
            result = await asyncio.to_thread(_execute)
        except FileNotFoundError as exc:  # pragma: no cover - environment guard
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ollama not found") from exc
        except subprocess.CalledProcessError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.stderr or exc.stdout or str(exc)
            ) from exc
        return (result.stdout or "").strip()


class ModelRefreshScheduler:
    """Coordinates periodic cache refreshes via APScheduler."""

    def __init__(self) -> None:
        self.scheduler: AsyncIOScheduler | None = None
        self.session_factory: async_sessionmaker[AsyncSession] | None = None
        self.settings: AppSettings | None = None

    def configure(
        self,
        *,
        settings: AppSettings,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory

    async def start(self) -> None:
        if self.scheduler or not self.session_factory or not self.settings:
            return
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            self._scheduled_refresh,
            "interval",
            seconds=self.settings.scheduler_poll_seconds,
            max_instances=1,
            coalesce=True,
            id="model-refresh",
        )
        scheduler.start()
        self.scheduler = scheduler
        model_cache.mark_scheduler("running")
        await self._scheduled_refresh()

    async def _scheduled_refresh(self) -> None:
        if not self.session_factory or not self.settings:
            return
        try:
            await refresh_model_cache(self.session_factory, self.settings)
            model_cache.mark_scheduler("running")
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("models.scheduler_refresh_failed", error=str(exc))
            model_cache.mark_error(str(exc))
            model_cache.mark_scheduler("error")

    async def shutdown(self) -> None:
        if self.scheduler:
            self.scheduler.shutdown(wait=False)
            self.scheduler = None
        model_cache.mark_scheduler("stopped")


model_scheduler = ModelRefreshScheduler()


async def refresh_model_cache(
    session_factory: async_sessionmaker[AsyncSession],
    settings: AppSettings,
) -> None:
    base_url = str(settings.ollama_base_url).rstrip("/")
    async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
        tags, processes = await _request_model_lists(client, base_url)
    async with session_factory() as session:
        await persist_process_stats(session, processes)
    model_cache.update(tags=tags, processes=processes, status="ok")
