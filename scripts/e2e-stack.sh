#!/usr/bin/env bash
# Full-stack Playwright smoke: Compose with the fake AI provider, torn down on any exit (failure or Ctrl-C).
set -euo pipefail
cd "$(dirname "$0")/.."

# Own project and volume, so the run never touches the dev database; still needs ports 5432/8000/8080 free.
stack=(docker compose -p journal-e2e -f docker-compose.yml -f docker-compose.e2e.yml)
status=1
cleanup() {
  [ "$status" -eq 0 ] || "${stack[@]}" logs --tail 200
  "${stack[@]}" down -v
}
trap cleanup EXIT

"${stack[@]}" up -d --build
# nginx answers on :8080 only after the backend is healthy (compose depends_on), so this waits for the whole chain.
./scripts/wait-for-url.sh http://localhost:8080/health 240
pnpm -C frontend e2e:stack
status=0
