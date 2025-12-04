// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ContentJobPayload = { job?: "legacy" | "docs"; networkId?: string; force?: boolean; dryRun?: boolean };
type ProgressPayload = { type: string; message?: string; detail?: any };

export const useContentJob = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<ProgressPayload | null>(null);
  const [running, setRunning] = useState(false);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev];
      next.push(line);
      return next.slice(-400);
    });
  }, []);

  const replaceLine = useCallback((line: string) => {
    setLogs((prev) => {
      if (prev.length === 0) {
        return [line];
      }
      const next = [...prev];
      next[next.length - 1] = line;
      return next;
    });
  }, []);

  const handleChunk = useCallback(
    (chunk: string) => {
      let buffer = "";
      let rewrite = false;
      for (const char of chunk) {
        if (char === "\r") {
          if (buffer) {
            if (rewrite) {
              replaceLine(buffer);
            } else {
              appendLog(buffer);
            }
          }
          buffer = "";
          rewrite = true;
        } else if (char === "\n") {
          if (buffer) {
            if (rewrite) {
              replaceLine(buffer);
            } else {
              appendLog(buffer);
            }
          }
          buffer = "";
          rewrite = false;
        } else {
          buffer += char;
        }
      }
      if (buffer) {
        if (rewrite) {
          replaceLine(buffer);
        } else {
          appendLog(buffer);
        }
      }
    },
    [appendLog, replaceLine]
  );

  useEffect(() => {
    window.appApi.subscribeContentProgress();
    const unsubscribe = window.appApi.onContentProgress((payload) => {
      handleChunk(`[${payload.type}] ${payload.message ?? ""}`);
      setStatus(payload);
      setRunning(payload.type !== "done");
    });
    return unsubscribe;
  }, [handleChunk]);

  const run = useCallback(async (payload: ContentJobPayload) => {
    setLogs([]);
    setStatus(null);
    await window.appApi.runContentJob(payload);
  }, []);

  const stop = useCallback(async () => {
    const result = await window.appApi.stopContentJob?.();
    if (result?.stopped) {
      appendLog("[stop] cancelled by user");
      setRunning(false);
    }
  }, [appendLog]);

  const summary = useMemo(() => {
    if (!status) return "Idle";
    if (status.type === "started") return "Starting…";
    if (status.type === "log") return "Running";
    if (status.type === "done") {
      if (status.detail?.code === 0) return "Completed";
      if (status.detail?.code === "deps_failed") return "Dependency install failed";
      if (status.detail?.code === "cancelled") return "Cancelled";
      return `Exited ${status.detail?.code ?? "?"}`;
    }
    return status.type;
  }, [status]);

  return { logs, running, status, summary, run, stop };
};
