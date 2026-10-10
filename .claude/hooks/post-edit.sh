#!/usr/bin/env bash
# PostToolUse: check only the edited file (plus types for app code). Exit 2 feeds errors back to Claude.
# Read-only on purpose: auto-fixing would change files underneath the editor.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
file="$(python3 -c 'import json,sys; print((json.load(sys.stdin).get("tool_input") or {}).get("file_path",""))' 2>/dev/null)"
rel="${file#"$PWD"/}"
fail() { echo "$1" | head -40 >&2; exit 2; }

case "$rel" in
  frontend/src/*.css)
    out="$(pnpm -s -C frontend exec stylelint "${rel#frontend/}" 2>&1)" || fail "$out" ;;
  frontend/src/*.ts|frontend/src/*.tsx|frontend/e2e/*.ts)
    out="$(pnpm -s -C frontend exec eslint "${rel#frontend/}" 2>&1)" || fail "$out"
    case "$rel" in *.test.ts|*.test.tsx|frontend/e2e/*) exit 0 ;; esac
    out="$(pnpm -s -C frontend typecheck:app 2>&1)" || fail "$out" ;;
  ai/*.py|backend/*.py)
    out="$(uv run --quiet ruff check "$rel" 2>&1 && uv run --quiet ruff format --check "$rel" 2>&1)" || fail "$out"
    case "$rel" in */tests/*|*/migrations/*|ai/evals/*) exit 0 ;; esac
    out="$(uv run --quiet mypy ai/journal_ai backend/app 2>&1)" || fail "$out" ;;
esac
exit 0
