"use client";

import { ReactNode, useEffect, useState } from "react";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="signup-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="signup-field-hint">{hint}</p> : null}
      {error ? <p className="signup-field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  disabled,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button className="signup-submit" type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className="signup-spinner" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="signup-form-error" role="alert">
      {message}
    </p>
  );
}

/**
 * Translate all public onboarding failures through the shared product-error
 * boundary. Server and provider messages are not safe user-interface copy.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  return userFacingMessage(error, fallback);
}

/** Client-side replica of the server's password rules (source: convex/lib/signup.ts). */
export function passwordRequirementFlags(password: string) {
  return {
    length: password.length >= 10,
    letterCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordMeetsPolicy(password: string): boolean {
  const flags = passwordRequirementFlags(password);
  return flags.length && flags.letterCase && flags.digit && flags.symbol;
}

/** 0-4 strength used by the strength meter. */
export function passwordStrengthScore(password: string): number {
  const flags = passwordRequirementFlags(password);
  return Number(flags.length) + Number(flags.letterCase) + Number(flags.digit) + Number(flags.symbol);
}

export function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrengthScore(password);
  return (
    <div className="signup-meter" aria-label={`Password strength: ${score} of 4`}>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`signup-meter-bar ${bar <= score ? `signup-meter-bar-on signup-meter-bar-lv${score}` : ""}`}
        />
      ))}
    </div>
  );
}

export function useCountdown(untilEpochMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilEpochMs || untilEpochMs <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [untilEpochMs]);
  const remaining = untilEpochMs ? Math.max(0, untilEpochMs - now) : 0;
  return Math.ceil(remaining / 1000);
}
