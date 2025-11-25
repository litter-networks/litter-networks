#!/bin/bash

# Mount OneDrive using rclone
# Remote name: onedrive-ln
# Mount point: ~/dev/ln/litter-networks/one-drive

MOUNT_POINT="$HOME/dev/ln/litter-networks/one-drive"
REMOTE_NAME="onedrive-ln"
LOGFILE="$HOME/.cache/rclone-onedrive.log"

echo "[mount-onedrive] Mounting $REMOTE_NAME → $MOUNT_POINT"

# Create mount directory if missing
mkdir -p "$MOUNT_POINT"

# Run mount in background (nohup)
nohup rclone mount "$REMOTE_NAME:" "$MOUNT_POINT" \
  --vfs-cache-mode writes \
  --poll-interval 1m \
  --dir-cache-time 5m \
  --log-file "$LOGFILE" \
  --log-level INFO \
  &

sleep 1

echo "[mount-onedrive] Done."
echo "[mount-onedrive] To unmount:  fusermount -u \"$MOUNT_POINT\""
echo "[mount-onedrive] Logs: $LOGFILE"
