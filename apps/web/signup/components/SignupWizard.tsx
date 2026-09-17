"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useQuery } from "@/app/lib/convex";
import { signup, type SignupSessionView } from "@/shared/convex/signup";
import { clearSignupSession } from "@/signup/actions";
import { IdentityStep } from "./steps/IdentityStep";
import { VerifyEmailStep } from "./steps/VerifyEmailStep";
import { OrganizationStep } from "./steps/OrganizationStep";
import { DefaultsStep } from "./steps/DefaultsStep";
import { SecureStep } from "./steps/SecureStep";
import { ProvisioningScreen } from "./steps/ProvisioningScreen";
import { AccountReady } from "./steps/AccountReady";

const STEPS = [
  { key: "identity", label: "Your details" },
  { key: "code", label: "Verify email" },
  { key: "organization", label: "Your workspace" },
  { key: "defaults", label: "Operating defaults" },
  { key: "secure", label: "Secure account" },
] as const;

export default function SignupWizard({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [restarting, startRestart] = useTransition();

  useEffect(() => {
    if (initialToken) return;
    let cancelled = false;
    fetch("/api/signup/start", { method: "POST" })
      .then(async (response) => {
        const data = (await response.json()) as { token?: string } | null;
        if (!cancelled) {
          if (response.ok && data?.token) setToken(data.token);
          else setTokenError("We could not start your sign-up. Please refresh and try again.");
        }
      })
      .catch(() => {
        if (!cancelled) setTokenError("We could not start your sign-up. Please refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  const sessionResult = useQuery(signup.getSession, token ? { token } : "skip");
  const formOptions = useQuery(signup.getFormOptions);

  function handleRestart() {
    startRestart(async () => {
      await clearSignupSession();
      setFatal(null);
      window.location.reload();
    });
  }

  if (tokenError) {
    return <RestartScreen message={tokenError} />;
  }

  if (fatal) {
    return <RestartScreen message={fatal} />;
  }

  if (!token || !formOptions) {
    return <LoadingShell label="Preparing your sign-up…" />;
  }

  if (sessionResult === undefined) {
    return <LoadingShell label="Checking where you were…" />;
  }

  // No session row yet: this is a brand-new visitor, so start at step 1
  // (the row is created on the first step's submit, not on first paint).
  const session = sessionResult === null ? freshSessionView() : sessionResult;

  if ("expired" in session) {
    return (
      <RestartScreen message="Your sign-up session has expired. Please start again." />
    );
  }
  const stepIndex = STEPS.findIndex((step) => step.key === session.state);
  const activeStep = STEPS[stepIndex]?.key;
  const isWizardStep = stepIndex >= 0;

  function handleFatal(message: string) {
    setFatal(message);
  }

  return (
    <div className="signup-card">
      <div className="signup-card-heading">
        <p className="signup-eyebrow">Sign up for MylesNet</p>
        <h1>Set up your workspace</h1>
        <p className="signup-card-subtitle">
          Already have an account?{" "}
          <Link href="/signin" className="signup-inline-link">
            Sign in
          </Link>
        </p>
      </div>

      {isWizardStep ? (
        <>
          <ol className="signup-stepper" aria-label="Sign-up progress">
            {STEPS.map((step, index) => (
              <li
                key={step.key}
                className={`signup-step ${index === stepIndex ? "signup-step-active" : ""} ${index < stepIndex ? "signup-step-done" : ""}`}
                aria-current={index === stepIndex ? "step" : undefined}
              >
                <span className="signup-step-circle">{index < stepIndex ? "✓" : index + 1}</span>
                <span className="signup-step-label">{step.label}</span>
              </li>
            ))}
          </ol>

          <div className="signup-step-body">
            {activeStep === "identity" ? (
              <IdentityStep token={token} session={session} onFatal={handleFatal} />
            ) : null}
            {activeStep === "code" ? (
              <VerifyEmailStep
                token={token}
                session={session}
                resendCooldownMs={formOptions.resendCooldownMs}
                onFatal={handleFatal}
              />
            ) : null}
            {activeStep === "organization" ? (
              <OrganizationStep
                token={token}
                session={session}
                signupDomain={formOptions.signupDomain}
                onFatal={handleFatal}
              />
            ) : null}
            {activeStep === "defaults" ? (
              <DefaultsStep token={token} session={session} formOptions={formOptions} onFatal={handleFatal} />
            ) : null}
            {activeStep === "secure" ? (
              <SecureStep
                token={token}
                formOptions={{ minPasswordLength: formOptions.minPasswordLength }}
                onFatal={handleFatal}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {session.state === "provisioning" || session.state === "failed" ? (
        <ProvisioningScreen
          key="provisioning"
          token={token}
          session={session}
          formOptions={formOptions}
          onFatal={handleFatal}
        />
      ) : null}

      {session.state === "ready" ? (
        <AccountReady session={session} formOptions={formOptions} />
      ) : null}

      <p className="signup-card-footer">
        <button
          type="button"
          className="signup-start-over"
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? "Restarting…" : "Start over from the beginning"}
        </button>
        <span aria-hidden="true">·</span>
        <span>Help is at <Link href="/contact" className="signup-inline-link">contact</Link></span>
      </p>
    </div>
  );
}

/**
 * A matching default view for a visitor with no session row yet; the wizard
 * renders step 1 from it and the Convex session is created on first submit.
 */
function freshSessionView(): SignupSessionView {
  return {
    state: "identity",
    firstName: "",
    lastName: "",
    email: "",
    emailVerified: false,
    emailVerifiedAt: null,
    codeSentAt: null,
    codeSentCount: 0,
    codeAttempts: 0,
    companyName: "",
    slug: "",
    country: "",
    timezone: "",
    currency: "",
    referralSource: "",
    phone: "",
    consented: false,
    passwordSet: false,
    workosOrganizationId: "",
    provisioning: [],
    expiresAt: 0,
    completedAt: null,
  };
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="signup-card signup-loading" role="status" aria-live="polite">
      <span className="signup-spinner signup-spinner-large" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function RestartScreen({ message }: { message: string }) {
  return (
    <div className="signup-card signup-loading" role="alert">
      <h2 className="signup-restart-title">Sign-up interruption</h2>
      <p className="signup-restart-text">{message}</p>
      <a className="signup-submit" href="/signup">
        Start over
      </a>
    </div>
  );
}