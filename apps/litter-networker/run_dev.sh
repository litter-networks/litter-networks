#!/bin/bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# Electron refuses to spawn a window if these are set (e.g. from some IDE terminals).
unset ELECTRON_RUN_AS_NODE ELECTRON_NO_ATTACH_CONSOLE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "[info] Validating SPDX headers..."
if ! python3 "$REPO_ROOT/tools/license_check.py"; then
  echo "[error] License header check failed. Run: python3 tools/license_fix.py"
  exit 1
fi

cd "$SCRIPT_DIR"

echo "[info] Running full test suite (build + tests)..."
npm run test:full

if [ -z "${VITE_DEV_SERVER_PORT:-}" ]; then
  echo "[info] Selecting an available renderer port..."
  VITE_DEV_SERVER_PORT="$(
    node <<'NODE'
const net = require("node:net");
const srv = net.createServer();
srv.listen(0, () => {
  const address = srv.address();
  if (address && typeof address === "object") {
    console.log(address.port);
  }
  srv.close();
});
NODE
  )"
  export VITE_DEV_SERVER_PORT
fi

VITE_DEV_SERVER_URL="http://localhost:${VITE_DEV_SERVER_PORT}"
export VITE_DEV_SERVER_URL
echo "[info] Launcher configured for ${VITE_DEV_SERVER_URL}"

npm run dev
