---
paths:
  - "backend/app/**"
  - "backend/migrations/**"
---
# Backend rules
- Layers: api → services → repositories → db. A route calls one service function; a service calls repositories and the analyzer.
- Repositories: queries only, typed returns, no commits, no business rules. One repository per aggregate.
- Services: own the transaction (`commit` once per use case), raise `AppError` subclasses, log one structured line per use case.
- Schemas: request/response models in `app/api/schemas`, `model_config = ConfigDict(from_attributes=True)` for ORM reads.
- New column or table → Alembic migration in the same commit; never edit an applied migration.
- Never log entry text, corrected text or mistakes; log ids, counts, timings.
