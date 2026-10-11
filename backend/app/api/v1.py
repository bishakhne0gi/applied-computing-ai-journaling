from fastapi import APIRouter

from app.api.routes import analyses, check, entries, insights, languages

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(languages.router)
api_router.include_router(entries.router)
api_router.include_router(analyses.router)
api_router.include_router(insights.router)
api_router.include_router(check.router)
