from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analyses import AnalysisService, AnalyzerPort
from app.services.entries import EntryService


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_analyzer(request: Request) -> AnalyzerPort:
    return cast(AnalyzerPort, request.app.state.analyzer)


def get_entry_service(session: SessionDep) -> EntryService:
    return EntryService(session)


def get_analysis_service(
    session: SessionDep, analyzer: Annotated[AnalyzerPort, Depends(get_analyzer)]
) -> AnalysisService:
    return AnalysisService(session, analyzer)


EntryServiceDep = Annotated[EntryService, Depends(get_entry_service)]
AnalysisServiceDep = Annotated[AnalysisService, Depends(get_analysis_service)]
