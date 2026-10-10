# Backend rules (FastAPI)

- Layout: `app/core` (config, logging, request context, errors, sentry) · `app/db` (session, base, models) · `app/repositories` · `app/services` · `app/api` (deps, routes, schemas) · `migrations` · `tests/{unit,integration}`.
- Async throughout. Services own transactions (`await session.commit()`); repositories only add, flush and query.
- Routes take and return `app/api/schemas` models; never return ORM objects directly.
- Services raise `AppError` subclasses; handlers render problem+json. Never raise `HTTPException` from services.
- Schema change: edit models → `make revision m="…"` → read the generated migration before committing.
- Unit tests need no database. Integration tests use the `db_session` / `client` fixtures (rolled back per test) and the fake analyzer.
