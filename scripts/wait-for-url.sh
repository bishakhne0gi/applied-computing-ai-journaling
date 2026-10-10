#!/usr/bin/env bash
set -euo pipefail
url="${1:?usage: wait-for-url.sh <url> [timeout_seconds]}"
timeout="${2:-120}"
for _ in $(seq "$timeout"); do
  curl -fsS "$url" >/dev/null 2>&1 && { echo "up: $url"; exit 0; }
  sleep 1
done
echo "timed out waiting for $url" >&2
exit 1
