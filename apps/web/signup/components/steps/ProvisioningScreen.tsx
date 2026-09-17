"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "@/app/lib/convex";
import { signup, type SignupFormOptions, type SignupSessionView } from "@/shared/convex/signup";
import { extractErrorMessage } from "../fields";

export function ProvisioningScreen({
  token,
  session,
  formOptions,
  onFatal,
}: {
  token: string;
  session: SignupSessionView;
  formOptions: SignupFormOptions;
  onFatal: (message: string) => void;
}) {
  const provisionStep = useAction(signup.provisionStep);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setRunError(null);
    const steps = formOptions.provisioningSteps.map((step) => step.key);
    try {
      while (true) {
        const result = await provisionStep({ token });
        setRunningKey(result.finished ? null : runningAfter(result.step, steps));
        if (result.finished) break;
        if (result.status === "failed") {
          setRunError("One of the set-up steps could not complete. You can retry.");
          break;
        }
      }
    } catch (error) {
      const message = extractErrorMessage(error, "Set-up could not complete right now.");
      setRunError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }, [provisionStep, token, formOptions.provisioningSteps, onFatal]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void run();
    }, 0);
    // Resume the run loop after a pause as the session moves through steps.
    return () => window.clearTimeout(timer);
  }, [run]);

  const failed = session.state === "failed" || runError !== null;
  const entries = new Map(session.provisioning.map((entry) => [entry.key, entry]));

  return (
    <div className="signup-provisioning" role="status" aria-live="polite">
      <p className="signup-provisioning-title">Setting up your workspace</p>
      <p className="signup-provisioning-subtitle">
        We are creating your workspace and finalizing secure account access. This takes a moment.
      </p>
      <ol className="signup-provisioning-list">
        {formOptions.provisioningSteps.map((step, index) => {
          const entry = entries.get(step.key);
          const status = entry?.status ?? (runningKey === step.key ? "running" : "pending");
          return (
            <li
              key={step.key}
              className={`signup-provisioning-row signup-provisioning-${status}`}
              data-index={index}
            >
              <span className="signup-provisioning-icon" aria-hidden="true">
                {status === "done" ? (
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : status === "running" ? (
                  <span className="signup-spinner" />
                ) : status === "failed" ? (
                  <span style={{ fontSize: 13, fontWeight: 800 }}>!</span>
                ) : (
                  <span className="signup-provisioning-dot" />
                )}
              </span>
              <span className="signup-provisioning-label">{step.label}</span>
              {status === "running" ? <span className="signup-provisioning-state">Working…</span> : null}
              {status === "done" && entry?.completedAt ? (
                <span className="signup-provisioning-state">
                  {Math.max(0, Math.round((entry.completedAt - entry.startedAt) / 100) / 10)}s
                </span>
              ) : null}
              {status === "pending" ? <span className="signup-provisioning-state">Queued</span> : null}
            </li>
          );
        })}
      </ol>
      {failed ? (
        <div className="signup-provisioning-error" role="alert">
          <p>{runError ?? "Set-up could not complete. You can retry."}</p>
          <button type="button" className="signup-submit" onClick={() => void run()} disabled={busy}>
            {busy ? <>Retrying…</> : "Retry"}
          </button>
        </div>
      ) : null}
      <p className="signup-provisioning-note">
        Do not close this tab while we finish setting up your workspace.
      </p>
      {session.slug ? (
        <p className="signup-provisioning-host">
          {session.slug}.{formOptions.signupDomain}
        </p>
      ) : null}
    </div>
  );
}

function runningAfter(currentStep: string, steps: readonly string[]): string | null {
  const index = steps.indexOf(currentStep);
  if (index === -1) return null;
  return steps[index + 1] ?? null;
}
