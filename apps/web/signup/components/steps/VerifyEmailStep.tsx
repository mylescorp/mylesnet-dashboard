"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useAction } from "@/app/lib/convex";
import { signup, type SignupSessionView } from "@/shared/convex/signup";
import { FormError, SubmitButton, extractErrorMessage, useCountdown } from "../fields";

const OTP_LENGTH = 6;

export function VerifyEmailStep({
  token,
  session,
  resendCooldownMs,
  onFatal,
}: {
  token: string;
  session: SignupSessionView;
  resendCooldownMs: number;
  onFatal: (message: string) => void;
}) {
  const requestCode = useAction(signup.requestCode);
  const verifyCode = useAction(signup.verifyCode);
  const requestedRef = useRef(false);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const resendAfterMs =
    session.codeSentAt === null ? null : session.codeSentAt + resendCooldownMs;
  const resendInSeconds = useCountdown(resendAfterMs);

  useEffect(() => {
    if (session.codeSentCount > 0 || requestedRef.current) return;
    requestedRef.current = true;
    requestCode({ token }).catch((error: unknown) => {
      setFormError(
        extractErrorMessage(error, "We could not send your code. Please try again in a moment."),
      );
    });
  }, [token, session.codeSentCount, requestCode]);

  async function handleResend() {
    setResending(true);
    setFormError(null);
    try {
      await requestCode({ token });
    } catch (error) {
      const message = extractErrorMessage(error, "We could not send your code. Please try again.");
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      setResending(false);
    }
  }

  async function submitCode(value: string) {
    if (value.length !== OTP_LENGTH || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await verifyCode({ token, code: value });
    } catch (error) {
      const message = extractErrorMessage(
        error,
        "The code you entered is incorrect or has expired.",
      );
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    const next = code.split("");
    next[index] = value.replace(/[^0-9]/g, "").slice(-1);
    const combined = next.join("").replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(combined);
    if (combined.length === OTP_LENGTH) void submitCode(combined);
  }

  function handlePaste(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    setCode(digits);
    const target = document.getElementById(`signup-otp-${digits.length - 1}`);
    target?.focus();
    if (digits.length === OTP_LENGTH) void submitCode(digits);
  }

  function handleBackspace(index: number) {
    const next = code.split("");
    next[index] = "";
    setCode(next.join(""));
    if (index > 0) document.getElementById(`signup-otp-${index - 1}`)?.focus();
  }

  return (
    <form className="signup-step-form" onSubmit={(event: FormEvent) => event.preventDefault()} noValidate>
      <p className="signup-step-description">
        We sent a code to <strong>{session.email}</strong>. Enter it below to verify your email.
      </p>
      <div className="signup-otp" aria-label="Verification code">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <input
            key={index}
            id={`signup-otp-${index}`}
            className="signup-otp-input"
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={code[index] ?? ""}
            disabled={submitting}
            onFocus={(event) => event.target.select()}
            onPaste={(event) => {
              event.preventDefault();
              handlePaste(event.clipboardData.getData("text"));
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Backspace" && !code[index]) {
                event.preventDefault();
                handleBackspace(index);
              }
            }}
            onChange={(event) => handleCodeInput(index, event.target.value)}
          />
        ))}
      </div>
      <p className="signup-code-hint">
        {resendInSeconds > 0 ? (
          <>You can request a new code in {resendInSeconds}s.</>
        ) : (
          <>
            Did not get it?{" "}
            <button type="button" className="signup-text-button" onClick={handleResend} disabled={resending}>
              {resending ? "Sending…" : "Send a new code"}
            </button>
          </>
        )}
      </p>
      <FormError message={formError} />
      <SubmitButton pending={submitting} disabled={code.length !== OTP_LENGTH}>
        Verify email
      </SubmitButton>
    </form>
  );
}