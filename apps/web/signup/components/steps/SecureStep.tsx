"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAction } from "@/app/lib/convex";
import { signup } from "@/shared/convex/signup";
import {
  Field,
  FormError,
  StrengthMeter,
  SubmitButton,
  extractErrorMessage,
  passwordMeetsPolicy,
  passwordRequirementFlags,
} from "../fields";

export function SecureStep({
  token,
  formOptions,
  onFatal,
}: {
  token: string;
  formOptions: { minPasswordLength: number };
  onFatal: (message: string) => void;
}) {
  const setPasswordAndConsent = useAction(signup.setPasswordAndConsent);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requirements = passwordRequirementFlags(password);
  const requirementsMet =
    requirements.length &&
    requirements.letterCase &&
    requirements.digit &&
    requirements.symbol &&
    password === confirmPassword &&
    consent;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordMeetsPolicy(password)) {
      setFormError(
        `Use at least ${formOptions.minPasswordLength} characters with an uppercase letter, a number and a symbol.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }
    if (!consent) {
      setFormError("Please accept the terms to continue.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await setPasswordAndConsent({ token, password, consent });
    } catch (error) {
      const message = extractErrorMessage(error, "We could not secure your account. Please try again.");
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="signup-step-form" onSubmit={handleSubmit} noValidate>
      <p className="signup-step-description">
        Create the password you will use to sign in to your workspace.
      </p>
      <Field
        label="Create a password"
        htmlFor="signup-password"
        hint={`At least ${formOptions.minPasswordLength} characters with an uppercase letter, a number and a symbol.`}
      >
        <div className="signup-password-wrap">
          <input
            id="signup-password"
            className="signup-input"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          <button
            type="button"
            className="signup-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
      <StrengthMeter password={password} />
      <ul className="signup-requirement-list" aria-label="Password requirements">
        <li className={requirements.length ? "signup-requirement-met" : ""}>{formOptions.minPasswordLength}+ characters</li>
        <li className={requirements.letterCase ? "signup-requirement-met" : ""}>Uppercase and lowercase letters</li>
        <li className={requirements.digit ? "signup-requirement-met" : ""}>A number</li>
        <li className={requirements.symbol ? "signup-requirement-met" : ""}>A symbol</li>
      </ul>
      <Field label="Confirm password" htmlFor="signup-confirm-password">
        <input
          id="signup-confirm-password"
          className="signup-input"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </Field>
      <label className="signup-consent" htmlFor="signup-consent">
        <input
          id="signup-consent"
          name="consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I agree to the{" "}
          <Link href="/legal/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FormError message={formError} />
      <SubmitButton pending={submitting} disabled={!requirementsMet}>
        Create account
      </SubmitButton>
    </form>
  );
}