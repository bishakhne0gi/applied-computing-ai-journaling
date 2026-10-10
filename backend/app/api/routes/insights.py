from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import InsightsServiceDep
from app.api.schemas.entries import LanguageCode
from app.api.schemas.insights import InsightsOut

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=InsightsOut)
async def get_insights(
    service: InsightsServiceDep, language: Annotated[LanguageCode | None, Query()] = None
) -> InsightsOut:
    return InsightsOut.model_validate(await service.get(language=language))
