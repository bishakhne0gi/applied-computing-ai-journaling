FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.0 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH

WORKDIR /srv
COPY pyproject.toml uv.lock ./
COPY ai/pyproject.toml ai/pyproject.toml
COPY backend/pyproject.toml backend/pyproject.toml
RUN uv sync --frozen --no-dev --package journal-backend --no-install-workspace

COPY ai ai
COPY backend backend
RUN uv sync --frozen --no-dev --package journal-backend

RUN useradd --create-home --uid 10001 app
USER app
WORKDIR /srv/backend

ARG RELEASE=dev
ENV RELEASE=$RELEASE LOG_FORMAT=json
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
