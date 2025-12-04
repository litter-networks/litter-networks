#!/bin/bash
# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# Mount OneDrive using rclone
# Remote name: onedrive-ln
# Mount point: ~/dev/ln/litter-networks/one-drive

MOUNT_POINT="$HOME/dev/ln/litter-networks/one-drive"
REMOTE_NAME="onedrive-ln"
LOGFILE="$HOME/.cache/rclone-onedrive.log"

echo "[mount-onedrive] Mounting $REMOTE_NAME → $MOUNT_POINT"

# Check if rclone is installed
if ! command -v rclone >/dev/null 2>&1; then
  echo "[mount-onedrive] ERROR: rclone is not installed." >&2
  exit 1
fi

# Verify remote exists
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "[mount-onedrive] ERROR: Remote '$REMOTE_NAME' is not configured in rclone." >&2
  exit 1
fi

# Create mount directory if missing
if ! mkdir -p "$MOUNT_POINT"; then
  echo "[mount-onedrive] ERROR: Failed to create mount directory $MOUNT_POINT." >&2
  exit 1
fi

mkdir -p "$(dirname "$LOGFILE")"

# Run mount in background (nohup)
nohup rclone mount "$REMOTE_NAME:" "$MOUNT_POINT" \
  --vfs-cache-mode writes \
  --poll-interval 1m \
  --dir-cache-time 5m \
  --log-file "$LOGFILE" \
  --log-level INFO \
  >/dev/null 2>&1 &

MOUNT_PID=$!
sleep 2

# Check if rclone process is still running
if ! kill -0 "$MOUNT_PID" 2>/dev/null; then
  echo "[mount-onedrive] ERROR: rclone mount failed to start." >&2
  tail -20 "$LOGFILE" >&2 || true
  exit 1
fi

check_mount() {
  if command -v mountpoint >/dev/null 2>&1; then
    mountpoint -q "$MOUNT_POINT"
  else
    grep -qs " $MOUNT_POINT " /proc/mounts
  fi
}

# Verify mount point is accessible
ATTEMPTS=30
SLEEP_INTERVAL=1
mounted=false
for _ in $(seq 1 "$ATTEMPTS"); do
  if check_mount; then
    mounted=true
    break
  fi
  sleep "$SLEEP_INTERVAL"
done

if [ "$mounted" != true ]; then
  echo "[mount-onedrive] ERROR: Mount point did not become available." >&2
  tail -20 "$LOGFILE" >&2 || true
  kill "$MOUNT_PID" >/dev/null 2>&1 || true
  exit 1
fi

echo "[mount-onedrive] Done."
echo "[mount-onedrive] To unmount:  fusermount -u \"$MOUNT_POINT\""
echo "[mount-onedrive] Logs: $LOGFILE"
