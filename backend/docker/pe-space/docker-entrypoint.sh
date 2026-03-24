#!/usr/bin/env bash
set -euo pipefail

# Try to start gateway automatically when openclaw exists.
if command -v openclaw >/dev/null 2>&1; then
  openclaw gateway start >/tmp/openclaw-gateway.log 2>&1 || true
fi

if [[ $# -eq 0 ]]; then
  exec sleep infinity
fi

exec "$@"
