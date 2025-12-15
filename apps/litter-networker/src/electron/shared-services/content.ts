// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import EventEmitter from "events";
import path from "node:path";
import { existsSync } from "node:fs";
import { app, WebContents } from "electron";

export type ContentJobKind = "legacy" | "docs" | "news";

export type ContentJobParams = {
  job?: ContentJobKind;
  networkId?: string;
  force?: boolean;
  dryRun?: boolean;
};

export type ContentJobStatus = {
  type: "started" | "log" | "done";
  message?: string;
  detail?: any;
};

export class ContentService extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private watchers = new Set<WebContents>();
  private dependenciesInstalled = false;
  private get pythonUtilsRoot() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "python-utils");
    }
    return path.join(path.resolve(__dirname, "../../../.."), "src", "python-utils");
  }

  private get venvPath() {
    return path.join(this.pythonUtilsRoot, ".venv");
  }

  private get venvPython() {
    return path.join(this.venvPath, process.platform === "win32" ? "Scripts/python.exe" : "bin/python3");
  }

  private buildScriptPath(job: ContentJobKind) {
    if (job === "docs") {
      return path.join(this.pythonUtilsRoot, "routes/utils/docs/sync_lnwordtohtml.py");
    }
    if (job === "news") {
      return path.join(this.pythonUtilsRoot, "routes/utils/images/news_upload.py");
    }
    return path.join(this.pythonUtilsRoot, "routes/utils/batch/create_missing_networks_items.py");
  }

  private requirementsPath() {
    return path.join(this.pythonUtilsRoot, "requirements.txt");
  }

  private async ensureDependencies() {
    if (this.dependenciesInstalled) {
      return;
    }
    if (!existsSync(this.venvPath)) {
      await new Promise<void>((resolve, reject) => {
        const creator = spawn(process.env.PYTHON_BINARY ?? "python3", ["-m", "venv", this.venvPath], {
          stdio: "inherit"
        });
        creator.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`Failed to create Python venv (exit ${code})`));
        });
      });
    }
    await new Promise<void>((resolve, reject) => {
      const installer = spawn(this.venvPython, ["-m", "pip", "install", "-r", this.requirementsPath()], {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: this.pythonUtilsRoot
      });
      installer.stdout.on("data", (chunk) => {
        this.emitStatus({ type: "log", message: chunk.toString() });
      });
      installer.stderr.on("data", (chunk) => {
        this.emitStatus({ type: "log", message: chunk.toString() });
      });
      installer.on("close", (code) => {
        if (code === 0) {
          this.dependenciesInstalled = true;
          resolve();
          return;
        }
        const err = new Error(`Failed to install Python dependencies (exit ${code})`);
        this.emitStatus({ type: "log", message: err.message });
        reject(err);
      });
    });
  }

  async run(params: ContentJobParams) {
    if (this.process) {
      throw new Error("Content job already running");
    }
    try {
      await this.ensureDependencies();
    } catch (error) {
      this.emitStatus({ type: "done", detail: { code: "deps_failed" }, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    const job: ContentJobKind = params.job ?? "legacy";
    const scriptPath = this.buildScriptPath(job);
    const args = [scriptPath];
    if (job === "legacy") {
      if (params.networkId) {
        args.push("--network", params.networkId);
      }
      if (params.force) {
        args.push("--force");
      }
    } else if (job === "docs") {
      args.push(params.dryRun ? "--dry-run" : "--no-dry-run");
    } else if (job === "news" && params.force) {
      // Allow forcing the news upload script even if not exposed in the UI.
      args.push("--force");
    }
    const repoRoot = path.resolve(this.pythonUtilsRoot, "..", "..", "..", "..");
    const env = { ...process.env, PYTHONPATH: this.pythonUtilsRoot, LN_REPO_ROOT: repoRoot };
    const proc = spawn(this.venvPython, args, {
      cwd: path.dirname(scriptPath),
      env
    });
    this.process = proc;
    this.emitStatus({ type: "started", detail: { params } });

    proc.stdout.on("data", (chunk) => {
      this.emitStatus({ type: "log", message: chunk.toString() });
    });
    proc.stderr.on("data", (chunk) => {
      this.emitStatus({ type: "log", message: chunk.toString() });
    });
    proc.on("close", (code) => {
      this.emitStatus({ type: "done", detail: { code } });
      this.process = null;
    });
  }

  stop() {
    if (!this.process) {
      return false;
    }
    this.process.kill("SIGTERM");
    this.emitStatus({ type: "done", detail: { code: "cancelled" }, message: "Job cancelled" });
    this.process = null;
    return true;
  }

  private emitStatus(payload: ContentJobStatus) {
    this.watchers.forEach((contents) => {
      contents.send("content:progress", payload);
    });
  }

  subscribe(contents: WebContents) {
    this.watchers.add(contents);
    contents.once("destroyed", () => this.watchers.delete(contents));
  }
}
