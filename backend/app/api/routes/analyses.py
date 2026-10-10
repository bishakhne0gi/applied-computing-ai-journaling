import uuid

from fastapi import APIRouter, status

from app.api.deps import AnalysisServiceDep
from app.api.schemas.analyses import AnalysisOut

router = APIRouter(prefix="/entries/{entry_id}/analyses", tags=["analyses"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AnalysisOut)
async def analyze_entry(entry_id: uuid.UUID, service: AnalysisServiceDep) -> AnalysisOut:
    # 201 even when the model failed: the analysis is a stored resource and its failure is part of its data.
    return AnalysisOut.model_validate(await service.run(entry_id))


@router.get("", response_model=list[AnalysisOut])
async def list_analyses(entry_id: uuid.UUID, service: AnalysisServiceDep) -> list[AnalysisOut]:
    return [AnalysisOut.model_validate(a) for a in await service.list_for_entry(entry_id)]
