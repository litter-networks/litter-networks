// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

"use strict";

/**
 * Launch Electron after stripping environment flags that force "run-as-node".
 * This keeps `npm run dev` reliable even when IDEs export Electron-specific vars.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const port = env.VITE_DEV_SERVER_PORT ? env.VITE_DEV_SERVER_PORT : "5173";
const defaultUrl = `http://localhost:${port}`;
env.VITE_DEV_SERVER_URL = env.VITE_DEV_SERVER_URL ?? defaultUrl;

const args = process.argv.slice(2);
const electronArgs = [...args, "."]; // Path to the Electron app goes last.

const child = spawn(electronBinary, electronArgs, {
  stdio: "inherit",
  env,
  cwd: path.resolve(__dirname, "..")
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
