.PHONY: install db migrate revision dev-backend dev-frontend up down lint typecheck test-ai test-backend test hygiene verify-fast verify

install:
	uv sync --all-packages
	pnpm -C frontend install

db:
	docker compose up -d db

migrate:
	cd backend && uv run alembic upgrade head

revision:
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

dev-backend:
	uv run uvicorn app.main:create_app --factory --reload --app-dir backend --port 8000 --no-access-log

dev-frontend:
	pnpm -C frontend dev

up:
	docker compose up --build

down:
	docker compose down

lint:
	uv run ruff check .
	uv run ruff format --check .
	cd backend && uv run lint-imports

typecheck:
	uv run mypy ai/journal_ai backend/app

test-ai:
	uv run pytest ai

test-backend:
	uv run pytest backend --cov=app --cov-report=term-missing:skip-covered --cov-fail-under=85

test: test-ai test-backend

hygiene:
	./scripts/check-hygiene.sh

verify-fast: lint typecheck
	pnpm -C frontend verify:fast

verify: hygiene lint typecheck test
	pnpm -C frontend verify
