from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep
from app.api.schemas.health import HealthResponse
from app.services.health import check_health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, responses={503: {"model": HealthResponse}})
async def health(session: SessionDep, response: Response) -> HealthResponse:
    result = await check_health(session)
    if not result.healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if result.healthy else "degraded",
        database="up" if result.database_up else "down",
    )
