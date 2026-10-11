from fastapi import APIRouter

from app.api.deps import CompletionServiceDep, RephraseServiceDep
from app.api.schemas.assist import CompleteOut, CompleteRequest, RephraseOut, RephraseRequest

router = APIRouter(tags=["assist"])


@router.post("/rephrase", response_model=RephraseOut)
async def rephrase(body: RephraseRequest, service: RephraseServiceDep) -> RephraseOut:
    # 200, not 201: nothing is created. 503 when the live model cannot answer or both slots are busy.
    result = await service.rephrase(body.text, body.start, body.end, body.language)
    return RephraseOut.model_validate(result, from_attributes=True)


@router.post("/complete", response_model=CompleteOut)
async def complete(body: CompleteRequest, service: CompletionServiceDep) -> CompleteOut:
    return CompleteOut(completion=await service.complete(body.text, body.language))
