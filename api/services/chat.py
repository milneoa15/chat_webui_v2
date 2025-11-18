"""Chat streaming service bridging Ollama responses to SSE events."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Sequence, cast

import httpx
import structlog
from fastapi import HTTPException, status
from pydantic import BaseModel

from ..config import AppSettings
from ..models import Message, MessageRole
from ..schemas import (
    ChatChunkEvent,
    ChatCompletionEvent,
    ChatErrorEvent,
    ChatHeartbeatEvent,
    ChatRequest,
    ChatStatusEvent,
    GenerationDefaults,
    MessageCreate,
    PromptOptions,
)
from .config import ConfigService
from .prompt_builder import PromptBuilder, PromptFragment
from .sessions import SessionService

logger = structlog.get_logger(__name__)


class ChatService:
    """Streams chat responses from Ollama to SSE clients while persisting state."""

    HEARTBEAT_SECONDS = 8.0
    HISTORY_LIMIT = 200

    def __init__(
        self,
        *,
        settings: AppSettings,
        http_client: httpx.AsyncClient,
        prompt_builder: PromptBuilder,
        config_service: ConfigService,
        session_service: SessionService,
    ) -> None:
        self.settings = settings
        self.http_client = http_client
        self.prompt_builder = prompt_builder
        self.config_service = config_service
        self.session_service = session_service

    async def stream_chat(self, payload: ChatRequest) -> AsyncGenerator[BaseModel, None]:
        """Yield SSE events as the assistant response streams from Ollama."""

        config = await self.config_service.get_or_create()
        defaults = config.generation_defaults
        model_name = payload.model or defaults.model
        resolved_options = self._resolve_options(defaults, payload.options)
        think_enabled = bool(payload.think)

        user_prompt = (payload.prompt or "").strip()
        should_persist_user = payload.regenerate_message_id is None
        if payload.regenerate_message_id is not None:
            # Remove the stale assistant message and reuse the existing user prompt.
            _, preserved_user = await self.session_service.prepare_regeneration(
                payload.session_id, payload.regenerate_message_id
            )
            user_prompt = preserved_user.content

        if not user_prompt:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prompt is required")

        history = await self.session_service.recent_messages(
            payload.session_id, limit=self.HISTORY_LIMIT
        )
        fragments = self._fragments_from_history(history)
        if payload.system_prompt:
            fragments.insert(
                0,
                PromptFragment(
                    role=MessageRole.SYSTEM,
                    content=payload.system_prompt.strip(),
                    source="system",
                    priority=0,
                ),
            )
        if should_persist_user:
            fragments.append(
                PromptFragment(
                    role=MessageRole.USER,
                    content=user_prompt,
                    source="live",
                    priority=100,
                )
            )

        ordered_prompt = self.prompt_builder.build(fragments)
        prompt_text = self._serialize_prompt(ordered_prompt)

        user_message_id: int | None = None
        if should_persist_user:
            message, _ = await self.session_service.add_message(
                payload.session_id,
                MessageCreate(role="user", content=user_prompt, model=model_name),
            )
            user_message_id = message.id
            logger.info(
                "chat.user_message_persisted",
                session_id=payload.session_id,
                message_id=user_message_id,
            )

        ollama_payload = self._build_ollama_payload(
            model_name, prompt_text, resolved_options, think_enabled=think_enabled
        )
        url = f"{str(config.ollama_base_url).rstrip('/')}/api/generate"
        logger.info(
            "chat.stream.start",
            session_id=payload.session_id,
            model=model_name,
            regenerate=payload.regenerate_message_id is not None,
        )

        assistant_buffer: list[str] = []
        thinking_text: str | None = None
        prompt_tokens: int | None = None
        completion_tokens: int | None = None
        total_tokens: int | None = None
        metrics: dict[str, Any] = {}
        started = time.perf_counter()
        last_heartbeat = started

        yield ChatStatusEvent(message="stream-started")
        while True:
            try:
                async with self.http_client.stream("POST", url, json=ollama_payload) as response:
                    response.raise_for_status()
                    async for raw_line in response.aiter_lines():
                        if raw_line is None:
                            continue
                        line = raw_line.strip()
                        now = time.perf_counter()
                        if not line:
                            if now - last_heartbeat >= self.HEARTBEAT_SECONDS:
                                yield ChatHeartbeatEvent(timestamp=datetime.now(timezone.utc))
                                last_heartbeat = now
                            continue
                        chunk = self._parse_chunk(line)
                        delta = chunk.get("response") or ""
                        thinking_delta: str | None = None
                        thinking_raw = chunk.get("thinking")
                        if isinstance(thinking_raw, str) and thinking_raw:
                            thinking_text = (thinking_text or "") + thinking_raw
                            thinking_delta = thinking_text
                        if delta:
                            assistant_buffer.append(delta)
                        if delta or thinking_delta:
                            yield ChatChunkEvent(
                                delta=delta,
                                content="".join(assistant_buffer),
                                thinking=thinking_text,
                            )
                            last_heartbeat = now
                        if chunk.get("done"):
                            prompt_tokens = chunk.get("prompt_eval_count")
                            completion_tokens = chunk.get("eval_count")
                            total_tokens = chunk.get("total_tokens")
                            metrics = self._build_metrics(chunk, started)
                            break
                    break
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code if exc.response else None
                if think_enabled and status_code == status.HTTP_400_BAD_REQUEST:
                    logger.info("chat.stream.retry_without_think", status=status_code)
                    ollama_payload = self._build_ollama_payload(
                        model_name, prompt_text, resolved_options, think_enabled=False
                    )
                    think_enabled = False
                    assistant_buffer.clear()
                    thinking_text = None
                    started = time.perf_counter()
                    last_heartbeat = started
                    yield ChatStatusEvent(
                        message="Reasoning not supported for this model; retrying without it."
                    )
                    continue
                logger.warning(
                    "chat.stream.http_status_error",
                    error=str(exc),
                    status=status_code,
                )
                yield ChatErrorEvent(message="Ollama request failed; check server logs")
                return
            except httpx.HTTPError as exc:
                logger.warning("chat.stream.http_error", error=str(exc))
                yield ChatErrorEvent(message="Ollama request failed; check server logs")
                return

        assistant_text = "".join(assistant_buffer).strip()
        if not assistant_text:
            yield ChatErrorEvent(message="No response received from Ollama")
            return

        if thinking_text:
            metrics = {**metrics, "thinking_text": thinking_text.strip()}

        assistant_payload = MessageCreate(
            role="assistant",
            content=assistant_text,
            model=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens or ((prompt_tokens or 0) + (completion_tokens or 0)),
            metrics=metrics,
        )
        assistant_message, _ = await self.session_service.add_message(
            payload.session_id, assistant_payload
        )
        logger.info(
            "chat.assistant_message_persisted",
            session_id=payload.session_id,
            message_id=assistant_message.id,
            user_message_id=user_message_id,
        )
        yield ChatCompletionEvent(
            message_id=assistant_message.id or 0,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            metrics=metrics,
        )

    def _fragments_from_history(self, messages: Sequence[Message]) -> list[PromptFragment]:
        fragments: list[PromptFragment] = []
        for message in messages:
            role = message.role if isinstance(message.role, MessageRole) else MessageRole(message.role)
            fragments.append(
                PromptFragment(
                    role=role,
                    content=message.content,
                    source=f"history:{message.id}",
                    priority=50,
                )
            )
        return fragments

    @staticmethod
    def _serialize_prompt(fragments: Sequence[PromptFragment]) -> str:
        lines: list[str] = []
        for fragment in fragments:
            role = fragment.role.value if isinstance(fragment.role, MessageRole) else str(fragment.role)
            content = fragment.content.strip()
            lines.append(f"{role}: {content}")
        return "\n\n".join(lines)

    @staticmethod
    def _resolve_options(
        defaults: GenerationDefaults, overrides: PromptOptions | None
    ) -> dict[str, Any]:
        def _value(key: str) -> Any:
            override_value = getattr(overrides, key) if overrides else None
            if override_value is None:
                default_value = getattr(defaults, key, None)
                if key == "stop":
                    return list(default_value or [])
                return default_value
            return override_value

        return {
            "temperature": _value("temperature"),
            "top_p": _value("top_p"),
            "top_k": _value("top_k"),
            "repeat_penalty": _value("repeat_penalty"),
            "context_window": _value("context_window"),
            "max_tokens": _value("max_tokens"),
            "stop": _value("stop"),
        }

    @staticmethod
    def _build_ollama_payload(
        model_name: str, prompt_text: str, options: dict[str, Any], *, think_enabled: bool = False
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model_name,
            "prompt": prompt_text,
            "stream": True,
            "options": {
                "temperature": options.get("temperature"),
                "top_p": options.get("top_p"),
            },
        }
        if think_enabled:
            payload["think"] = True
        if options.get("top_k") is not None:
            payload["options"]["top_k"] = options["top_k"]
        if options.get("repeat_penalty") is not None:
            payload["options"]["repeat_penalty"] = options["repeat_penalty"]
        if options.get("context_window") is not None:
            payload["options"]["num_ctx"] = options["context_window"]
        if options.get("max_tokens") is not None:
            payload["options"]["num_predict"] = options["max_tokens"]
        stops = options.get("stop") or []
        if stops:
            payload["options"]["stop"] = stops
        return payload

    @staticmethod
    def _parse_chunk(raw_line: str) -> dict[str, Any]:
        try:
            return cast(dict[str, Any], json.loads(raw_line))
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive guard
            logger.warning("chat.stream.malformed_chunk", error=str(exc), line=raw_line)
            return cast(dict[str, Any], {})

    @staticmethod
    def _build_metrics(chunk: dict[str, Any], started: float) -> dict[str, Any]:
        eval_duration_ns = chunk.get("eval_duration")
        duration_seconds = ChatService._ns_to_seconds(eval_duration_ns)
        if duration_seconds is None:
            duration_seconds = max(time.perf_counter() - started, 0.001)
        completion_tokens = chunk.get("eval_count") or 0
        tokens_per_second = None
        if duration_seconds and completion_tokens:
            tokens_per_second = round(completion_tokens / duration_seconds, 2)
        return {
            "load_duration_ms": ChatService._ns_to_ms(chunk.get("load_duration")),
            "prompt_eval_duration_ms": ChatService._ns_to_ms(chunk.get("prompt_eval_duration")),
            "eval_duration_ms": ChatService._ns_to_ms(eval_duration_ns),
            "total_duration_ms": ChatService._ns_to_ms(chunk.get("total_duration")),
            "tokens_per_second": tokens_per_second,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _ns_to_ms(value: int | float | None) -> float | None:
        if value is None:
            return None
        return round(float(value) / 1_000_000, 3)

    @staticmethod
    def _ns_to_seconds(value: int | float | None) -> float | None:
        if value is None:
            return None
        return float(value) / 1_000_000_000
