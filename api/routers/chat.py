"""Chat streaming routes (SSE + WebSocket fallback)."""
from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, WebSocket
from fastapi.responses import StreamingResponse

from ..dependencies import get_chat_service
from ..schemas import ChatRequest
from ..services.chat import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_class=StreamingResponse)
async def stream_chat(
    payload: ChatRequest, service: ChatService = Depends(get_chat_service)
) -> StreamingResponse:
    """Proxy streaming chat responses as SSE events."""

    async def event_stream() -> AsyncIterator[str]:
        async for event in service.stream_chat(payload):
            yield f"data: {event.model_dump_json()}\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket) -> None:
    """WebSocket fallback placeholder until real-time channel is implemented."""

    await websocket.accept()
    await websocket.send_json(
        {"message": "WebSocket fallback is not yet available. Use /api/chat for SSE streaming."}
    )
    await websocket.close()
