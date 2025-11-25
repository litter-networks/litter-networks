#!/bin/bash
set -euo pipefail

# Electron refuses to spawn a window if these are set (e.g. from some IDE terminals).
unset ELECTRON_RUN_AS_NODE ELECTRON_NO_ATTACH_CONSOLE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${VITE_PORT:-5173}"
if ! command -v lsof >/dev/null 2>&1; then
  echo "[error] Required dependency 'lsof' is not installed."
  echo "[error] Install it (e.g., 'brew install lsof' or 'sudo apt install lsof') and re-run this script."
  exit 1
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "[warn] Port $PORT is already in use by:"
  lsof -iTCP:"$PORT" -sTCP:LISTEN -Pn
  echo "[warn] Dev server may fail until that process is stopped."
  exit 1
fi

npm run dev
