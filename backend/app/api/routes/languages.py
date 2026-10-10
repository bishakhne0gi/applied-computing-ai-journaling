from fastapi import APIRouter

from app.api.schemas.languages import LanguageOut
from journal_ai import SUPPORTED_LANGUAGES

router = APIRouter(prefix="/languages", tags=["languages"])


@router.get("", response_model=list[LanguageOut])
async def list_languages() -> list[LanguageOut]:
    return [LanguageOut(code=code, name=name) for code, name in SUPPORTED_LANGUAGES.items()]
