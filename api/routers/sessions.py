"""Session and message routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status

from ..dependencies import get_session_service, get_title_service
from ..schemas import (
    MessageCreate,
    MessageListResponse,
    MessagePinRequest,
    MessageRead,
    MessageRegenerateResponse,
    SessionCreate,
    SessionListResponse,
    SessionMetricsResponse,
    SessionRead,
    SessionUpdate,
)
from ..services.sessions import SessionService
from ..services.title import TitleService

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=SessionListResponse)
async def list_sessions(service: SessionService = Depends(get_session_service)) -> SessionListResponse:
    sessions = await service.list_sessions()
    return SessionListResponse(items=[service.to_session_read(item) for item in sessions])


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate, service: SessionService = Depends(get_session_service)
) -> SessionRead:
    session_obj = await service.create_session(payload)
    return service.to_session_read(session_obj)


@router.patch("/{session_id}", response_model=SessionRead)
async def rename_session(
    session_id: int, payload: SessionUpdate, service: SessionService = Depends(get_session_service)
) -> SessionRead:
    session_obj = await service.update_session(session_id, payload)
    return service.to_session_read(session_obj)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int, service: SessionService = Depends(get_session_service)
) -> Response:
    await service.delete_session(session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{session_id}/messages", response_model=MessageListResponse)
async def list_messages(
    session_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: SessionService = Depends(get_session_service),
) -> MessageListResponse:
    messages, total = await service.list_messages(session_id, limit=limit, offset=offset)
    return MessageListResponse(
        items=[service.to_message_read(message) for message in messages],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/{session_id}/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    session_id: int,
    payload: MessageCreate,
    service: SessionService = Depends(get_session_service),
    title_service: TitleService = Depends(get_title_service),
) -> MessageRead:
    message, session_obj = await service.add_message(session_id, payload)
    if payload.role == "user" and service.should_generate_title(session_obj):
        title_service.queue_title_generation(
            session_id=session_id,
            prompt=payload.content,
            model=payload.model,
        )
    return service.to_message_read(message)


@router.delete("/{session_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    session_id: int,
    message_id: int,
    service: SessionService = Depends(get_session_service),
) -> Response:
    await service.delete_message(session_id, message_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{session_id}/messages/{message_id}/pin", response_model=MessageRead)
async def toggle_pin(
    session_id: int,
    message_id: int,
    payload: MessagePinRequest,
    service: SessionService = Depends(get_session_service),
) -> MessageRead:
    message = await service.set_message_pin(session_id, message_id, payload.pinned)
    return service.to_message_read(message)


@router.post(
    "/{session_id}/messages/{message_id}/regenerate",
    response_model=MessageRegenerateResponse,
)
async def request_regeneration(
    session_id: int,
    message_id: int,
    service: SessionService = Depends(get_session_service),
) -> MessageRegenerateResponse:
    assistant, user_message = await service.prepare_regeneration(
        session_id, message_id, delete=False
    )
    return MessageRegenerateResponse(
        session_id=session_id,
        assistant_message_id=assistant.id or 0,
        prompt=user_message.content,
        model=assistant.model,
    )


@router.get("/{session_id}/metrics", response_model=SessionMetricsResponse)
async def session_metrics(
    session_id: int, service: SessionService = Depends(get_session_service)
) -> SessionMetricsResponse:
    return await service.collect_metrics(session_id)
