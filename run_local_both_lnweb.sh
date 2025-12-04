#!/usr/bin/env bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
API_SCRIPT="${SCRIPT_DIR}/web/lnweb-api/run_local_server.sh"
REACT_SCRIPT="${SCRIPT_DIR}/web/lnweb-react/run_local_server.sh"

PIDS=()
failure_status=0

start_service() {
  local label="$1"
  local script="$2"
  shift 2

  echo "[info] Starting ${label}..."
  "${script}" "$@" &
  local pid=$!
  sleep 1
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    if wait "$pid"; then
      failure_status=1
    else
      failure_status=$?
    fi
    echo "[error] ${label} exited before other services could start (status ${failure_status})."
    cleanup
    exit "$failure_status"
  fi
  PIDS+=("$pid")
  echo "[info] ${label} running as PID ${pid}."
}

cleanup() {
  if [ ${#PIDS[@]} -gt 0 ]; then
    echo "[info] Stopping lnweb processes..."
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
}

handle_interrupt() {
  echo "[info] Caught interrupt; shutting down lnweb services..."
  failure_status=130
  cleanup
  exit "$failure_status"
}

handle_term() {
  echo "[info] Received termination signal; shutting down lnweb services..."
  failure_status=143
  cleanup
  exit "$failure_status"
}

trap handle_interrupt INT
trap handle_term TERM

start_service "lnweb-api local server" "${API_SCRIPT}" "$@"
start_service "lnweb-react local server" "${REACT_SCRIPT}" "$@"

echo "[info] lnweb-api (PID ${PIDS[0]}) and lnweb-react (PID ${PIDS[1]}) are running. Press Ctrl+C to stop both."

while [ ${#PIDS[@]} -gt 0 ]; do
  if wait -n; then
    :
  else
    failure_status=$?
    echo "[error] Detected lnweb process failure (exit code ${failure_status}); stopping remaining services."
    cleanup
    exit "$failure_status"
  fi
  alive=()
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      alive+=("$pid")
    fi
  done
  PIDS=("${alive[@]}")
done

cleanup
exit 0
