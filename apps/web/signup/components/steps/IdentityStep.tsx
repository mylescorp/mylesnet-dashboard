"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@/app/lib/convex";
import { signup, type SignupSessionView } from "@/shared/convex/signup";
import { Field, FormError, SubmitButton, extractErrorMessage } from "../fields";

type IdentityFields = { firstName: string; lastName: string; email: string };

export function IdentityStep({
  token,
  session,
  onFatal,
}: {
  token: string;
  session: SignupSessionView;
  onFatal: (message: string) => void;
}) {
  const begin = useMutation(signup.begin);
  const [form, setForm] = useState<IdentityFields>({
    firstName: session.firstName || "",
    lastName: session.lastName || "",
    email: session.email || "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof IdentityFields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Partial<Record<keyof IdentityFields, string>> = {};
    const firstName = form.firstName.trim().replace(/\s+/g, " ");
    const lastName = form.lastName.trim().replace(/\s+/g, " ");
    const email = form.email.trim().toLowerCase();
    if (firstName.length < 2) errors.firstName = "Enter your first name.";
    if (lastName.length < 2) errors.lastName = "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await begin({
        token,
        firstName: form.firstName.trim().replace(/\s+/g, " "),
        lastName: form.lastName.trim().replace(/\s+/g, " "),
        email: form.email.trim().toLowerCase(),
      });
    } catch (error) {
      const message = extractErrorMessage(error, "We could not start your sign-up. Please try again.");
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="signup-step-form" onSubmit={handleSubmit} noValidate>
      <p className="signup-step-description">
        Tell us who you are. Your email becomes the login for your workspace.
      </p>
      <div className="signup-field-row">
        <Field label="First name" htmlFor="signup-first-name" error={fieldErrors.firstName}>
          <input
            id="signup-first-name"
            className="signup-input"
            name="firstName"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="Last name" htmlFor="signup-last-name" error={fieldErrors.lastName}>
          <input
            id="signup-last-name"
            className="signup-input"
            name="lastName"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            required
          />
        </Field>
      </div>
      <Field label="Work email" htmlFor="signup-email" error={fieldErrors.email}>
        <input
          id="signup-email"
          className="signup-input"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
      </Field>
      <FormError message={formError} />
      <SubmitButton pending={submitting}>Continue</SubmitButton>
    </form>
  );
}