#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${VITE_PORT:-5173}"
if lsof -iTCP:"$PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "[warn] Port $PORT is already in use by:"
  lsof -iTCP:"$PORT" -sTCP:LISTEN -Pn
  echo "[warn] Dev server may fail until that process is stopped."
  exit
fi

npm run dev
