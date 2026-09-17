"use client";

import { useState } from "react";
import { useTransition } from "react";
import { signInAfterSignup } from "@/signup/actions";
import { type SignupFormOptions, type SignupSessionView } from "@/shared/convex/signup";

export function AccountReady({
  session,
  formOptions,
}: {
  session: SignupSessionView;
  formOptions: SignupFormOptions;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGoToSignIn() {
    setError(null);
    startTransition(() => {
      void signInAfterSignup(session.workosOrganizationId || "", session.email).catch(() => {
        setError("We could not open the sign-in screen. Please sign in from the top of this page.");
      });
    });
  }

  return (
    <div className="signup-ready" aria-live="polite">
      <span className="signup-ready-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="signup-ready-title">You are all set.</h2>
      <p className="signup-ready-text">
        Your workspace is ready at <strong>{session.slug}.{formOptions.signupDomain}</strong>. Sign in with
        your verified email address <strong>{session.email}</strong>.
      </p>
      <button
        type="button"
        className="signup-submit"
        onClick={handleGoToSignIn}
        disabled={pending}
      >
        {pending ? (
          <>
            <span className="signup-spinner" aria-hidden="true" />
            Opening sign in…
          </>
        ) : (
          "Go to sign in"
        )}
      </button>
      <p className="signup-ready-note">
        Then sign in with your new password to finish setting up your account.
      </p>
      {error ? (
        <p className="signup-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
