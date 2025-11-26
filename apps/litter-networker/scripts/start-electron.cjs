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

if (!env.VITE_DEV_SERVER_URL) {
  env.VITE_DEV_SERVER_URL = "http://localhost:5173";
}

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
