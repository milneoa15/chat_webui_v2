"""Title generation routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..dependencies import get_title_service
from ..schemas import TitleRequest, TitleResponse
from ..services.title import TitleService

router = APIRouter(prefix="/api/title", tags=["sessions"])


@router.post("", response_model=TitleResponse)
async def generate_title(
    payload: TitleRequest, service: TitleService = Depends(get_title_service)
) -> TitleResponse:
    title = await service.generate_title(payload.session_id, payload.prompt, model=payload.model)
    return TitleResponse(session_id=payload.session_id, title=title)
