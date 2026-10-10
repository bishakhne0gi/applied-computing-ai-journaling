from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.system import database_is_reachable


@dataclass(frozen=True)
class HealthStatus:
    database_up: bool

    @property
    def healthy(self) -> bool:
        return self.database_up


async def check_health(session: AsyncSession) -> HealthStatus:
    return HealthStatus(database_up=await database_is_reachable(session))
