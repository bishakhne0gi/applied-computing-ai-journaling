#!/usr/bin/env bash
# Stop: block "done" while lint or types are red. Never loops (stop_hook_active) and tolerates
# red-phase tests because the fast gate type-checks app code only.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
active="$(python3 -c 'import json,sys; print(bool(json.load(sys.stdin).get("stop_hook_active")))' 2>/dev/null)"
[ "$active" = "True" ] && exit 0
out="$(make -s verify-fast 2>&1)" || { echo "Quality gate (make verify-fast) failed — fix before finishing:" >&2; echo "$out" | tail -40 >&2; exit 2; }
exit 0
