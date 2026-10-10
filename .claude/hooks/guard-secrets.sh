#!/usr/bin/env bash
# PreToolUse: keep real env files (.env, .env.local, ...) out of the transcript. Rule-based deny lists
# can't cover every shell form (head -n 5 .env, grep KEY .env), so scan the whole command/path instead.
# `.env.example` is documentation and stays readable. Exit 2 blocks the tool call.
set -uo pipefail
python3 -c '
import json, re, sys
try:
    ti = json.load(sys.stdin).get("tool_input") or {}
except Exception:
    sys.exit(0)
pat = re.compile(r"(?<![\w.-])\.env(\.[\w.-]+)?(?![\w-])")
for key in ("command", "file_path", "path", "pattern"):
    val = ti.get(key)
    if not isinstance(val, str):
        continue
    for m in pat.finditer(val):
        if m.group(1) != ".example":
            sys.stderr.write("Blocked: access to a real env file is not allowed (only .env.example is readable).\n")
            sys.exit(2)
' 
