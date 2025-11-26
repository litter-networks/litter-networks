#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_DIR="$REPO_ROOT/apps/litter-networker/src/python-utils"
VENV_DIR="$UTILS_DIR/.venv"
PYTHON_BIN="${PYTHON_BINARY:-python3}"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[setup] Creating python-utils virtualenv..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

export LN_REPO_ROOT="$REPO_ROOT"

echo "[setup] Ensuring python-utils dependencies are installed..."
(
  cd "$UTILS_DIR"
  "$VENV_DIR/bin/python" -m pip install -r "requirements.txt" >/dev/null
)

function run_stage() {
  local label="$1"
  shift
  echo ""
  echo "${label}... ========================="
  local start
  start=$(date +%s)
  "$@"
  local elapsed=$(( $(date +%s) - start ))
  echo "${label} took ${elapsed} seconds."
}

echo "[docs] Running lnwordtohtml sync ($*)"
run_stage "lnwordtohtml sync" "$VENV_DIR/bin/python" -m lnwordtohtml.cli sync "$@"
