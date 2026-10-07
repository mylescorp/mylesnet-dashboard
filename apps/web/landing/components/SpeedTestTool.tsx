"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Activity, Timer, RefreshCw, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

/**
 * Production-grade speed test component measuring against this site's endpoint.
 * Provides: ping (median of 8 samples), jitter (mean absolute deviation),
 * download (12 MB streaming), upload (4 MB POST). All results in browser —
 * nothing stored server-side.
 */

type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";

type Results = {
  ping: number | null;
  jitter: number | null;
  download: number | null;
  upload: number | null;
};

const PING_SAMPLES = 8;
const DOWNLOAD_BYTES = 12 * 1024 * 1024;
const UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DOWNLOAD_DURATION = 15000;
const MAX_UPLOAD_DURATION = 10000;

const EMPTY_RESULTS: Results = {
  ping: null,
  jitter: null,
  download: null,
  upload: null,
};

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Ready when you are.",
  ping: "Measuring latency…",
  download: "Measuring download…",
  upload: "Measuring upload…",
  done: "Test complete.",
  error: "The test could not finish — please try again.",
};

const measurePing = async (): Promise<{ ping: number; jitter: number }> => {
  const samples: number[] = [];
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10000);

  try {
    for (let i = 0; i < PING_SAMPLES; i += 1) {
      const started = performance.now();
      await fetch(`/api/speedtest?op=ping&nc=${started}`, {
        cache: "no-store",
        signal: abortController.signal,
      });
      samples.push(performance.now() - started);
    }
  } finally {
    clearTimeout(timeout);
  }

  if (samples.length < 3) throw new Error("Insufficient ping samples");

  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const ping =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;

  let spread = 0;
  for (let i = 1; i < samples.length; i += 1) {
    spread += Math.abs(samples[i] - samples[i - 1]);
  }
  const jitter = spread / (samples.length - 1);

  return { ping, jitter };
};

const measureDownload = async (
  onProgress: (fraction: number) => void,
  signal: AbortSignal
): Promise<number> => {
  const started = performance.now();
  const response = await fetch(
    `/api/speedtest?op=download&bytes=${DOWNLOAD_BYTES}`,
    { cache: "no-store", signal }
  );
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  if (!response.body) throw new Error("streaming unavailable");

  const reader = response.body.getReader();
  let received = 0;
  let lastProgressUpdate = 0;

  for (;;) {
    if (performance.now() - started > MAX_DOWNLOAD_DURATION) {
      throw new Error("download timeout");
    }
    const { done, value } = await reader.read();
    if (done) break;
    received += value?.byteLength ?? 0;
    const fraction = Math.min(1, received / DOWNLOAD_BYTES);
    if (fraction - lastProgressUpdate >= 0.02) {
      onProgress(fraction);
      lastProgressUpdate = fraction;
    }
  }

  const seconds = (performance.now() - started) / 1000;
  return seconds > 0 ? (received * 8) / seconds / 1e6 : 0;
};

const measureUpload = async (signal: AbortSignal): Promise<number> => {
  const payload = new ArrayBuffer(UPLOAD_BYTES);
  const started = performance.now();
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), MAX_UPLOAD_DURATION);
  const linkedSignal = AbortSignal.any([signal, timeoutController.signal]);

  let response: Response;
  try {
    response = await fetch(`/api/speedtest?op=upload`, {
      method: "POST",
      body: payload,
      cache: "no-store",
      signal: linkedSignal,
    });
  } catch (err) {
    if (timeoutController.signal.aborted) throw new Error("upload timeout");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`upload failed: ${response.status}`);
  await response.json();

  const seconds = (performance.now() - started) / 1000;
  return seconds > 0 ? (payload.byteLength * 8) / seconds / 1e6 : 0;
};

const METRICS = [
  { key: "download", label: "Download", unit: "Mbps", icon: ArrowDown },
  { key: "upload", label: "Upload", unit: "Mbps", icon: ArrowUp },
  { key: "ping", label: "Ping", unit: "ms", icon: Activity },
  { key: "jitter", label: "Jitter", unit: "ms", icon: Timer },
] as const;

export default function SpeedTestTool() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setResults(EMPTY_RESULTS);
    setProgress(0);
    setErrorMessage(null);

    try {
      setPhase("ping");
      const { ping, jitter } = await measurePing();
      if (signal.aborted) return;
      setResults((previous) => ({ ...previous, ping, jitter }));

      setPhase("download");
      const download = await measureDownload(setProgress, signal);
      if (signal.aborted) return;
      setResults((previous) => ({ ...previous, download }));

      setPhase("upload");
      const upload = await measureUpload(signal);
      if (signal.aborted) return;
      setResults((previous) => ({ ...previous, upload }));

      setProgress(1);
      setPhase("done");
    } catch (err) {
      if (signal.aborted) return;
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    } finally {
      if (!signal.aborted) {
        runningRef.current = false;
        abortControllerRef.current = null;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    runningRef.current = false;
    setPhase("idle");
    setResults(EMPTY_RESULTS);
    setProgress(0);
    setErrorMessage(null);
  }, []);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const busy = phase === "ping" || phase === "download" || phase === "upload";
  const decimals = (value: number | null, places: number) =>
    value === null ? "—" : value.toFixed(places);

  return (
    <div className="landing-tool">
      <div className="landing-tool-grid">
        {METRICS.map(({ key, label, unit, icon: Icon }) => (
          <div
            key={key}
            className={`landing-card landing-card-compact landing-tool-metric ${
              phase === "done" && results[key] !== null
                ? "landing-tool-metric--has-value"
                : ""
            }`}
          >
            <span className="landing-tool-label">
              <Icon size={15} aria-hidden="true" />
              {label}
            </span>
            <span className="landing-tool-value">
              {decimals(results[key], key === "ping" || key === "jitter" ? 1 : 2)}
              <span className="landing-tool-unit">{unit}</span>
            </span>
          </div>
        ))}
      </div>

      <progress
        className="landing-tool-progress"
        value={phase === "done" ? 1 : progress}
        max={1}
        aria-label="Test progress"
      />

      <div className="landing-tool-actions">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
          <Button
            type="button"
            onClick={busy ? cancel : run}
            disabled={false}
            variant={busy ? "outline" : "default"}
            size="lg"
            style={{ flex: 1, minWidth: 160 }}
          >
            {busy ? (
              <>
                <X size={18} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
                Cancel
              </>
            ) : results.ping === null ? (
              "Run speed test"
            ) : (
              <>
                <RefreshCw size={18} aria-hidden="true" />
                Run again
              </>
            )}
          </Button>
        </div>
        <p className="landing-tool-status" role="status" aria-live="polite">
          {errorMessage ?? PHASE_LABEL[phase]}
        </p>
      </div>

      <p className="landing-prose-note">
        One connection, measured against this site&apos;s own server — it shows your link to us,
        not your line&apos;s absolute capacity. For a fuller picture, run it at different times
        of day and compare.
      </p>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}