from fastapi import APIRouter

from app.api.deps import LiveCheckServiceDep
from app.api.schemas.check import CheckOut, CheckRequest, HintOut

router = APIRouter(tags=["check"])


@router.post("/check", response_model=CheckOut)
async def check_text(body: CheckRequest, service: LiveCheckServiceDep) -> CheckOut:
    # 200, not 201: nothing is created. 503 when the live model cannot answer; the client then hides
    # hints quietly.
    result = await service.check(body.text, body.language)
    return CheckOut(
        analyzed_text=result.analyzed_text,
        hints=[HintOut.model_validate(m) for m in result.mistakes],
    )
