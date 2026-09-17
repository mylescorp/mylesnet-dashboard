"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { signup, type SignupSessionView } from "@/shared/convex/signup";
import { Field, FormError, SubmitButton, extractErrorMessage } from "../fields";

export function OrganizationStep({
  token,
  session,
  signupDomain,
  onFatal,
}: {
  token: string;
  session: SignupSessionView;
  signupDomain: string;
  onFatal: (message: string) => void;
}) {
  const setOrganization = useMutation(signup.setOrganization);
  const [form, setForm] = useState({ companyName: session.companyName || "", slug: session.slug || "" });
  const [debouncedSlug, setDebouncedSlug] = useState<string>(form.slug.trim());
  const [fieldErrors, setFieldErrors] = useState<Partial<{ companyName: string; slug: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSlug(form.slug.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.slug]);

  const isCheckingSlug = form.slug.trim() !== debouncedSlug;
  const slugQuery = useQuery(
    signup.checkSlug,
    debouncedSlug.length >= 2 ? { token, slug: debouncedSlug } : "skip",
  );

  function normalizeSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 63);
  }

  function validate(): boolean {
    const errors: Partial<{ companyName: string; slug: string }> = {};
    const companyName = form.companyName.trim().replace(/\s+/g, " ");
    const slug = normalizeSlug(form.slug);
    if (companyName.length < 2) errors.companyName = "Enter your business name.";
    if (slug.length < 2 || slug.length > 63) {
      errors.slug = "Use between 2 and 63 characters.";
    } else if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      errors.slug = "Use letters, numbers and single hyphens.";
    } else if (slugQuery?.status === "unavailable") {
      errors.slug = "That workspace address is taken.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await setOrganization({
        token,
        companyName: form.companyName.trim().replace(/\s+/g, " "),
        slug: normalizeSlug(form.slug),
      });
    } catch (error) {
      const message = extractErrorMessage(error, "We could not reserve your workspace. Please try again.");
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      setSubmitting(false);
    }
  }

  const slugOk = slugQuery?.status === "available";
  const slugPending =
    isCheckingSlug || (debouncedSlug.length >= 2 && slugQuery?.status === "idle" && !slugQuery.host);
  const trimmedSlug = normalizeSlug(form.slug);

  return (
    <form className="signup-step-form" onSubmit={handleSubmit} noValidate>
      <p className="signup-step-description">
        Your workspace gets its own address on MylesNet, where your team works.
      </p>
      <Field label="Business name" htmlFor="signup-company-name" error={fieldErrors.companyName}>
        <input
          id="signup-company-name"
          className="signup-input"
          name="companyName"
          autoComplete="organization"
          value={form.companyName}
          onChange={(event) => setForm({ ...form, companyName: event.target.value })}
          required
          autoFocus
        />
      </Field>
      <Field
        label="Workspace address"
        htmlFor="signup-slug"
        hint={`Your team works at ${trimmedSlug || "<address>"}.${signupDomain}`}
        error={fieldErrors.slug}
      >
        <div className="signup-slug">
          <input
            id="signup-slug"
            className="signup-input signup-slug-input"
            name="slug"
            autoComplete="off"
            spellCheck={false}
            placeholder="my-network"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: normalizeSlug(event.target.value) })}
            aria-describedby="signup-slug-hint"
          />
          {slugPending ? (
            <span className="signup-slug-status signup-slug-status-pending" aria-hidden="true">
              <span className="signup-spinner signup-spinner-inline" />
            </span>
          ) : null}
          {slugOk ? <span className="signup-slug-status signup-slug-status-ok">Available</span> : null}
          {slugQuery?.status === "unavailable" && !fieldErrors.slug ? (
            <span className="signup-slug-status signup-slug-status-taken">Taken</span>
          ) : null}
        </div>
      </Field>
      {slugQuery?.status === "available" && !slugPending ? (
        <p className="signup-availability-note">
          This address is available to reserve. You can change it later in workspace settings.
        </p>
      ) : null}
      <FormError message={formError} />
      <SubmitButton pending={submitting} disabled={!slugOk}>
        Continue
      </SubmitButton>
    </form>
  );
}