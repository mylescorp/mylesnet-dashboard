import { makeFunctionReference } from "convex/server";

/**
 * Client-side type + reference bindings for the public sign-up wizard
 * (`convex/signup.ts`). These are explicit `makeFunctionReference` strings,
 * pinned to the committed `_generated` runtime, so the wizard needs no
 * generated-API regeneration.
 */

export type SignupStepState =
  | "identity"
  | "code"
  | "organization"
  | "defaults"
  | "secure"
  | "provisioning"
  | "ready"
  | "failed"
  | "expired";

export type SignupProvisioningEntryView = {
  key: string;
  label: string;
  status: "running" | "done" | "failed";
  startedAt: number;
  completedAt: number | null;
  error: string;
};

export type SignupSessionView = {
  state: SignupStepState;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: number | null;
  codeSentAt: number | null;
  codeSentCount: number;
  codeAttempts: number;
  companyName: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  referralSource: string;
  phone: string;
  consented: boolean;
  passwordSet: boolean;
  workosOrganizationId: string;
  provisioning: SignupProvisioningEntryView[];
  expiresAt: number;
  completedAt: number | null;
};

export type SignupSessionResult = null | { expired: true } | SignupSessionView;

export type SignupSlugCheck =
  | { status: "idle" | "invalid" | "unavailable"; host: null }
  | { status: "available"; host: string };

export type ProvisionStepResult = {
  finished: boolean;
  step: string;
  status: string;
};

export type SignupFormOptions = {
  referralSources: Array<{ value: string; label: string }>;
  provisioningSteps: Array<{ key: string; label: string }>;
  minPasswordLength: number;
  resendCooldownMs: number;
  signupDomain: string;
};

export const signup = {
  getFormOptions: makeFunctionReference<"query", Record<string, never>, SignupFormOptions>(
    "signup:getFormOptions",
  ),
  getSession: makeFunctionReference<"query", { token: string }, SignupSessionResult>(
    "signup:getSession",
  ),
  begin: makeFunctionReference<
    "mutation",
    { token: string; firstName: string; lastName: string; email: string },
    { started: boolean; resumed: boolean }
  >("signup:begin"),
  requestCode: makeFunctionReference<"mutation", { token: string }, { sent: boolean }>(
    "signup:requestCode",
  ),
  verifyCode: makeFunctionReference<"mutation", { token: string; code: string }, { verified: boolean }>(
    "signup:verifyCode",
  ),
  checkSlug: makeFunctionReference<"query", { token: string; slug: string }, SignupSlugCheck>(
    "signup:checkSlug",
  ),
  setOrganization: makeFunctionReference<
    "mutation",
    { token: string; companyName: string; slug: string },
    { accepted: boolean }
  >("signup:setOrganization"),
  setDefaults: makeFunctionReference<
    "mutation",
    {
      token: string;
      country: string;
      timezone: string;
      currency: string;
      referralSource?: string;
      phone?: string;
    },
    { accepted: boolean }
  >("signup:setDefaults"),
  setPasswordAndConsent: makeFunctionReference<
    "mutation",
    { token: string; password: string; consent: boolean },
    { accepted: boolean }
  >("signup:setPasswordAndConsent"),
  provisionStep: makeFunctionReference<"action", { token: string }, ProvisionStepResult>(
    "signup:provisionStep",
  ),
};