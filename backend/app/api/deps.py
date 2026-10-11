import asyncio
from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analyses import AnalysisService, AnalyzerPort
from app.services.entries import EntryService
from app.services.insights.service import InsightsService
from app.services.live_check import LiveCheckService
from app.services.writing_assist import CompletionService, RephraseService
from journal_ai import WritingAssist


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_analyzer(request: Request) -> AnalyzerPort:
    return cast(AnalyzerPort, request.app.state.analyzer)


def get_live_analyzer(request: Request) -> AnalyzerPort:
    return cast(AnalyzerPort, request.app.state.live_analyzer)


def get_live_slots(request: Request) -> asyncio.Semaphore:
    return cast(asyncio.Semaphore, request.app.state.live_slots)


def get_writing_assist(request: Request) -> WritingAssist:
    return cast(WritingAssist, request.app.state.writing_assist)


def get_rephrase_slots(request: Request) -> asyncio.Semaphore:
    return cast(asyncio.Semaphore, request.app.state.rephrase_slots)


def get_complete_slots(request: Request) -> asyncio.Semaphore:
    return cast(asyncio.Semaphore, request.app.state.complete_slots)


def get_entry_service(session: SessionDep) -> EntryService:
    return EntryService(session)


def get_analysis_service(
    session: SessionDep, analyzer: Annotated[AnalyzerPort, Depends(get_analyzer)]
) -> AnalysisService:
    return AnalysisService(session, analyzer)


def get_insights_service(session: SessionDep) -> InsightsService:
    return InsightsService(session)


def get_live_check_service(
    analyzer: Annotated[AnalyzerPort, Depends(get_live_analyzer)],
    slots: Annotated[asyncio.Semaphore, Depends(get_live_slots)],
) -> LiveCheckService:
    return LiveCheckService(analyzer, slots)


def get_rephrase_service(
    assist: Annotated[WritingAssist, Depends(get_writing_assist)],
    slots: Annotated[asyncio.Semaphore, Depends(get_rephrase_slots)],
) -> RephraseService:
    return RephraseService(assist, slots)


def get_completion_service(
    assist: Annotated[WritingAssist, Depends(get_writing_assist)],
    slots: Annotated[asyncio.Semaphore, Depends(get_complete_slots)],
) -> CompletionService:
    return CompletionService(assist, slots)


EntryServiceDep = Annotated[EntryService, Depends(get_entry_service)]
AnalysisServiceDep = Annotated[AnalysisService, Depends(get_analysis_service)]
InsightsServiceDep = Annotated[InsightsService, Depends(get_insights_service)]
LiveCheckServiceDep = Annotated[LiveCheckService, Depends(get_live_check_service)]
RephraseServiceDep = Annotated[RephraseService, Depends(get_rephrase_service)]
CompletionServiceDep = Annotated[CompletionService, Depends(get_completion_service)]
