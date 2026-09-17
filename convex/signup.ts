/**
 * Public self-service sign-up wizard (spec `centipid_onboarding_spec.md`):
 * identity -> email code -> workspace name -> operating defaults -> password
 * & consent -> provisioning -> account ready.
 *
 * A signed-in user is never required; tenancy authority comes from the
 * per-session WorkOS state below, and every mutating handler enforces the
 * wizard's own server-side state machine (no client trust).
 */

import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  MYLESNET_SIGNUP_SESSION_MAX_AGE_MS,
  WORKOS_EMAIL_CODE_RESEND_COOLDOWN_MS,
  WORKOS_EMAIL_CODE_MAX_ATTEMPTS,
  SIGNUP_HOST_DOMAIN,
  SIGNUP_PROVISIONING_STEPS,
  SIGNUP_REFERRAL_SOURCES,
  MIN_PASSWORD_LENGTH,
  isValidBusinessName,
  isValidCountryCode,
  isValidCurrencyCode,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidReferralSource,
  isValidSignupSlug,
  isValidTimezone,
  normalizeBusinessName,
  normalizeDisplayName,
  normalizeEmail,
  normalizeSlug,
  sanitizePhone,
} from "./lib/signup";
import { sha256Hex } from "./lib/sha256";
import {
  addWorkosOrganizationMembership,
  createWorkosOrganization,
  createWorkosUserWithProfile,
  getWorkosOrganizationByExternalId,
  getWorkosOrganizationMembership,
  getWorkosUserByEmail,
  getWorkosUserProfile,
  sendWorkosEmailVerification,
  setWorkosUserPassword,
  verifyWorkosEmailCode,
} from "./workos";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

function hashToken(token: string): string {
  return sha256Hex(`__mylesnet_signup:${token}`);
}

/**
 * WorkOS helpers throw plain `Error`, whose message is redacted to
 * "Server Error" on production deployments. Re-throw anything the caller
 * intended as user-facing (`ConvexError`) untouched, and convert everything
 * else into a safe, actionable message while keeping the real cause in logs.
 */
function rethrowIdentityError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  console.error("signup: identity provider call failed", error);
  throw new ConvexError("We couldn't complete that step right now. Please try again in a moment.");
}

/**
 * Provisioning progress is visible to an unauthenticated browser. Keep
 * provider and database diagnostics in server logs, never in that progress
 * record, so a failed operation cannot disclose implementation details.
 */
function safeProvisioningFailure(error: unknown, message: string): string {
  console.error("signup: provisioning step failed", error);
  return message;
}

function deterministicUserExternalId(email: string): string {
  return `mylesnet-signup-${sha256Hex(email).slice(0, 24)}`;
}

function provisioningStepEntry(
  key: string,
  startedAt: number,
  status: "running" | "done" | "failed",
  extras: { completedAt?: number; error?: string; ref?: string } = {},
) {
  const label = SIGNUP_PROVISIONING_STEPS.find((step) => step.key === key)?.label ?? key;
  return { key, label, startedAt, status, ...extras };
}

/** Sanitized view a client may read about its own wizard session. */
function publicSessionView(session: Doc<"signupSessions">) {
  return {
    state: session.state,
    firstName: session.firstName ?? "",
    lastName: session.lastName ?? "",
    email: session.email ?? "",
    emailVerified: session.workosEmailVerified === true,
    emailVerifiedAt: session.emailVerifiedAt ?? null,
    codeSentAt: session.codeSentAt ?? null,
    codeSentCount: session.codeSentCount ?? 0,
    codeAttempts: session.codeAttempts ?? 0,
    companyName: session.companyName ?? "",
    slug: session.slug ?? "",
    country: session.country ?? "",
    timezone: session.timezone ?? "",
    currency: session.currency ?? "",
    referralSource: session.referralSource ?? "",
    phone: session.phone ?? "",
    consented: session.consentAt != null,
    passwordSet: session.passwordSetAt != null,
    workosOrganizationId: session.workosOrganizationId ?? "",
    provisioning: session.provisioning.map((entry) => ({
      key: entry.key,
      label: entry.label,
      status: entry.status,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt ?? null,
      error: entry.error ?? "",
    })),
    expiresAt: session.expiresAt,
    completedAt: session.completedAt ?? null,
  };
}

/** Static, data-driven options for the wizard's form controls. */
export const getFormOptions = query({
  args: {},
  handler: async () => ({
    referralSources: SIGNUP_REFERRAL_SOURCES.map((source) => ({ value: source.value, label: source.label })),
    provisioningSteps: SIGNUP_PROVISIONING_STEPS.map((step) => ({ key: step.key, label: step.label })),
    minPasswordLength: MIN_PASSWORD_LENGTH,
    resendCooldownMs: WORKOS_EMAIL_CODE_RESEND_COOLDOWN_MS,
    signupDomain: SIGNUP_HOST_DOMAIN,
  }),
});

export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", hashToken(token)))
      .first();
    if (!session) return null;
    if (Date.now() > session.expiresAt) return { expired: true };
    return publicSessionView(session);
  },
});

export const begin = mutation({
  args: {
    token: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { token, firstName, lastName, email }) => {
    const emailValue = normalizeEmail(email);
    if (!isValidEmail(emailValue)) throw new ConvexError("Please enter a valid email address.");
    const first = normalizeDisplayName(firstName);
    const last = normalizeDisplayName(lastName);
    if (!isValidDisplayName(first) || !isValidDisplayName(last)) {
      throw new ConvexError("Please enter your full name.");
    }
    const tokenHash = hashToken(token);
    const existing = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (existing) {
      if (Date.now() > existing.expiresAt) {
        throw new ConvexError("Your sign-up session has expired. Please start again.");
      }
      if (
        existing.state === "organization" ||
        existing.state === "defaults" ||
        existing.state === "secure" ||
        existing.state === "provisioning" ||
        existing.state === "ready"
      ) {
        throw new ConvexError("A sign-up for this browser is already in progress.");
      }
      await ctx.db.patch(existing._id, {
        firstName: first,
        lastName: last,
        email: emailValue,
        state: "code",
        updatedAt: Date.now(),
      });
      return { started: true, resumed: true };
    }
    await ctx.db.insert("signupSessions", {
      tokenHash,
      state: "code",
      firstName: first,
      lastName: last,
      email: emailValue,
      provisioning: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + MYLESNET_SIGNUP_SESSION_MAX_AGE_MS,
    });
    return { started: true, resumed: false };
  },
});

export const requestCode = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ sent: true }> => {
    const now = Date.now();
    const tokenHash = hashToken(token);
    const session = await ctx.runQuery(internal.signup.getSessionInternal, { tokenHash });
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (now > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (!session.email) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (session.state !== "identity" && session.state !== "code") {
      throw new ConvexError("A sign-up for this browser is already in progress.");
    }
    if (session.workosEmailVerified === true) {
      await ctx.runMutation(internal.signup.advanceToOrganizationInternal, { tokenHash });
      return { sent: true };
    }
    if (session.codeSentAt && now - session.codeSentAt < WORKOS_EMAIL_CODE_RESEND_COOLDOWN_MS) {
      throw new ConvexError("Please wait a moment before requesting another code.");
    }

    let workosUserId = session.workosUserId;
    try {
      if (workosUserId) {
        const profile = await getWorkosUserProfile(workosUserId);
        if (profile.emailVerified) {
          throw new ConvexError("An account with this email already exists. Sign in instead.");
        }
      } else {
        const existing = await getWorkosUserByEmail(session.email);
        if (existing) {
          const profile = await getWorkosUserProfile(existing);
          if (profile.emailVerified) {
            throw new ConvexError("An account with this email already exists. Sign in instead.");
          }
          workosUserId = existing;
        } else {
          workosUserId = await createWorkosUserWithProfile({
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            externalId: deterministicUserExternalId(session.email),
          });
        }
      }
      await sendWorkosEmailVerification(workosUserId);
    } catch (error) {
      rethrowIdentityError(error);
    }
    await ctx.runMutation(internal.signup.markCodeSentInternal, { tokenHash, workosUserId, now });
    return { sent: true };
  },
});

export const verifyCode = action({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, { token, code }): Promise<{ verified: true }> => {
    const now = Date.now();
    const tokenHash = hashToken(token);
    const session = await ctx.runQuery(internal.signup.getSessionInternal, { tokenHash });
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (now > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (session.state !== "identity" && session.state !== "code") {
      throw new ConvexError("A sign-up for this browser is already in progress.");
    }
    if (session.workosEmailVerified === true) {
      await ctx.runMutation(internal.signup.advanceToOrganizationInternal, { tokenHash });
      return { verified: true };
    }
    if (!session.workosUserId) throw new ConvexError("Please request a verification code first.");
    const attempts = (session.codeAttempts ?? 0) + 1;
    if (attempts > WORKOS_EMAIL_CODE_MAX_ATTEMPTS) throw new ConvexError("Too many attempts. Please request a new code.");
    const sanitizedCode = code.trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(sanitizedCode)) {
      await ctx.runMutation(internal.signup.recordCodeAttemptInternal, { tokenHash, attempts, now });
      throw new ConvexError("Enter the 6-digit code from the email.");
    }
    try {
      await verifyWorkosEmailCode(session.workosUserId, sanitizedCode);
    } catch {
      await ctx.runMutation(internal.signup.recordCodeAttemptInternal, { tokenHash, attempts, now });
      throw new ConvexError("The code you entered is incorrect or has expired.");
    }
    await ctx.runMutation(internal.signup.markEmailVerifiedInternal, { tokenHash, now });
    return { verified: true };
  },
});

export const checkSlug = query({
  args: { token: v.string(), slug: v.string() },
  handler: async (ctx, { token, slug }) => {
    const now = Date.now();
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", hashToken(token)))
      .first();
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (now > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    const value = normalizeSlug(slug);
    if (!value) return { status: "idle" as const, host: null };
    if (!isValidSignupSlug(value)) return { status: "invalid" as const, host: null };
    const takenTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", value))
      .first();
    if (takenTenant) return { status: "unavailable" as const, host: null };
    const competing = await ctx.db
      .query("signupSessions")
      .withIndex("by_slug", (q) => q.eq("slug", value))
      .first();
    if (competing && competing._id !== session._id && now <= competing.expiresAt) {
      const state = competing.state;
      if (
        state !== "identity" &&
        state !== "code" &&
        state !== "expired" &&
        state !== "failed"
      ) {
        return { status: "unavailable" as const, host: null };
      }
    }
    return { status: "available" as const, host: `${value}.${SIGNUP_HOST_DOMAIN}` };
  },
});

export const setOrganization = mutation({
  args: { token: v.string(), companyName: v.string(), slug: v.string() },
  handler: async (ctx, { token, companyName, slug }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", hashToken(token)))
      .first();
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (Date.now() > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (session.workosEmailVerified !== true) {
      throw new ConvexError("Please verify your email before continuing.");
    }
    const name = normalizeBusinessName(companyName);
    if (!isValidBusinessName(name)) throw new ConvexError("Please enter your business name.");
    const value = normalizeSlug(slug);
    if (!isValidSignupSlug(value)) {
      throw new ConvexError("Please enter a valid workspace address.");
    }
    const now = Date.now();
    const takenTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", value))
      .first();
    if (takenTenant) throw new ConvexError("That workspace address is already taken.");
    const platformRun = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_slug", (q) => q.eq("slug", value))
      .order("desc")
      .first();
    if (platformRun && platformRun.tenantId !== session.tenantId) {
      throw new ConvexError("That workspace address is unavailable.");
    }
    const competing = await ctx.db
      .query("signupSessions")
      .withIndex("by_slug", (q) => q.eq("slug", value))
      .first();
    if (competing && competing._id !== session._id && now <= competing.expiresAt) {
      const state = competing.state;
      if (
        state !== "identity" &&
        state !== "code" &&
        state !== "expired" &&
        state !== "failed"
      ) {
        throw new ConvexError("That workspace address is unavailable.");
      }
    }
    await ctx.db.patch(session._id, {
      companyName: name,
      slug: value,
      state: "defaults",
      updatedAt: now,
    });
    return { accepted: true };
  },
});

export const setDefaults = mutation({
  args: {
    token: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
    referralSource: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { token, country, timezone, currency, referralSource, phone }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", hashToken(token)))
      .first();
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (Date.now() > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (session.workosEmailVerified !== true) {
      throw new ConvexError("Please verify your email before continuing.");
    }
    const countryValue = country.trim().toUpperCase();
    const currencyValue = currency.trim().toUpperCase();
    if (!isValidCountryCode(countryValue)) throw new ConvexError("Please choose your country.");
    if (!isValidTimezone(timezone)) throw new ConvexError("Please choose your timezone.");
    if (!isValidCurrencyCode(currencyValue)) throw new ConvexError("Please choose your currency.");
    const reference = referralSource ?? "";
    if (reference && !isValidReferralSource(reference)) throw new ConvexError("Please choose a valid referral source.");
    const phoneValue = phone ?? "";
    if (!isValidPhone(phoneValue)) throw new ConvexError("Please enter a valid phone number.");
    await ctx.db.patch(session._id, {
      country: countryValue,
      timezone,
      currency: currencyValue,
      referralSource: reference || undefined,
      phone: sanitizePhone(phoneValue) || undefined,
      state: "secure",
      updatedAt: Date.now(),
    });
    return { accepted: true };
  },
});

export const setPasswordAndConsent = action({
  args: { token: v.string(), password: v.string(), consent: v.boolean() },
  handler: async (ctx, { token, password, consent }): Promise<{ accepted: true }> => {
    const now = Date.now();
    const tokenHash = hashToken(token);
    const session = await ctx.runQuery(internal.signup.getSessionInternal, { tokenHash });
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (now > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (session.workosEmailVerified !== true) {
      throw new ConvexError("Please verify your email before choosing a password.");
    }
    if (!isValidPassword(password)) {
      throw new ConvexError("Use at least 10 characters with an uppercase letter, a number and a symbol.");
    }
    if (!consent) throw new ConvexError("Please agree to the Terms of service and Privacy policy to continue.");
    if (!session.workosUserId) throw new ConvexError("Please request a verification code first.");
    try {
      await setWorkosUserPassword(session.workosUserId, password);
    } catch (error) {
      rethrowIdentityError(error);
    }
    await ctx.runMutation(internal.signup.markPasswordSetInternal, { tokenHash, now });
    return { accepted: true };
  },
});

/**
 * Execute the next pending provisioning step. The client calls this in a loop;
 * each call performs exactly one step and appends its real timestamps to the
 * session so the Account ready screen reveals rows as they complete.
 */
export const provisionStep = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ finished: boolean; step: string; status: string }> => {
    const tokenHash = hashToken(token);
    const session = await ctx.runQuery(internal.signup.getSessionInternal, { tokenHash });
    if (!session) throw new ConvexError("Your sign-up session could not be found. Please start again.");
    if (Date.now() > session.expiresAt) throw new ConvexError("Your sign-up session has expired. Please start again.");
    if (session.state === "ready") return { finished: true, step: "ready", status: "done" };

    const entries = session.provisioning;
    const running = entries.find((entry) => entry.status === "running");
    const failed = entries.filter((entry) => entry.status === "failed");
    let nextKey: string;
    if (running) {
      nextKey = running.key;
    } else if (failed.length > 0) {
      nextKey = failed[failed.length - 1]!.key;
    } else {
      const finishedKeys = new Set(entries.filter((entry) => entry.status === "done").map((entry) => entry.key));
      const pending = SIGNUP_PROVISIONING_STEPS.find((step) => !finishedKeys.has(step.key));
      if (!pending) {
        await ctx.runMutation(internal.signup.finishProvisioningInternal, { tokenHash });
        return { finished: true, step: "ready", status: "done" };
      }
      nextKey = pending.key;
    }

    const startedAt = Date.now();
    await ctx.runMutation(internal.signup.markProvisioningInternal, {
      tokenHash,
      key: nextKey,
      startedAt,
      status: "running",
    });

    if (nextKey === "accountAddress") {
      let organizationId = session.workosOrganizationId;
      try {
        // Reserve the workspace address against the platform-assisted flow
        // before contacting WorkOS. This keeps a concurrent Platform "New
        // tenant" request from creating or adopting the same tenant org.
        await ctx.runMutation(internal.signup.assertWorkspaceAvailableForSignup, {
          tokenHash,
          slug: session.slug ?? "",
        });
        const externalId = `mylesnet-tenant-${session.slug ?? ""}`;
        if (!organizationId) {
          const existing = await getWorkosOrganizationByExternalId(externalId);
          if (existing) {
            // Only a previously persisted session reference is safe to
            // resume. An unclaimed provider org may belong to a different
            // onboarding flow or a legacy workspace, so never adopt it.
            throw new Error("Workspace identity already exists");
          } else {
            const created = await createWorkosOrganization(session.companyName ?? "", externalId);
            organizationId = created.id;
          }
        }
        const outcome = await ctx.runMutation(internal.signup.commitTenantInternal, {
          tokenHash,
          slug: session.slug ?? "",
          companyName: session.companyName ?? "",
          country: session.country ?? "",
          timezone: session.timezone ?? "",
          currency: session.currency ?? "",
          phone: session.phone ?? "",
          acquisitionSource: session.referralSource ?? "",
          workosOrganizationId: organizationId,
          workosUserId: session.workosUserId ?? "",
        });
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "done",
          ref: outcome.organizationId,
        });
        return { finished: false, step: nextKey, status: "done" };
      } catch (error) {
        const message = safeProvisioningFailure(error, "The workspace could not be prepared. Please retry.");
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "failed",
          error: message,
        });
        return { finished: false, step: nextKey, status: "failed" };
      }
    }

    if (nextKey === "adminAccount") {
      const organizationId = session.workosOrganizationId ?? "";
      const workosUserId = session.workosUserId ?? "";
      try {
        let membership = await getWorkosOrganizationMembership(organizationId, workosUserId);
        if (!membership) {
          membership = await addWorkosOrganizationMembership(organizationId, workosUserId, "tenant_admin");
        }
        if (membership.status.toLowerCase() !== "active") {
          throw new Error("Tenant administrator membership is not active");
        }
        const outcome = await ctx.runMutation(internal.signup.commitAdminInternal, {
          tokenHash,
          workosMembershipId: membership.id,
        });
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "done",
          ref: outcome.membershipId,
        });
        return { finished: false, step: nextKey, status: "done" };
      } catch (error) {
        const message = safeProvisioningFailure(error, "Administrator access could not be prepared. Please retry.");
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "failed",
          error: message,
        });
        return { finished: false, step: nextKey, status: "failed" };
      }
    }

    if (nextKey === "welcomeEmail") {
      try {
        const tenantRef = session.tenantId;
        if (!tenantRef) throw new ConvexError("The workspace has not been created yet.");
        const welcomeId = await ctx.runMutation(internal.signup.recordWelcomeInternal, {
          tokenHash,
          tenantId: tenantRef,
          tenantSlug: session.slug ?? "",
          email: session.email ?? "",
        });
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "done",
          ref: welcomeId,
        });
        return { finished: false, step: nextKey, status: "done" };
      } catch (error) {
        const message = safeProvisioningFailure(error, "Account confirmation could not be completed. Please retry.");
        await ctx.runMutation(internal.signup.markProvisioningInternal, {
          tokenHash,
          key: nextKey,
          startedAt,
          status: "failed",
          error: message,
        });
        return { finished: false, step: nextKey, status: "failed" };
      }
    }

    await ctx.runMutation(internal.signup.finishProvisioningInternal, { tokenHash });
    return { finished: true, step: "ready", status: "done" };
  },
});

export const getSessionInternal = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    return ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
  },
});

export const markCodeSentInternal = internalMutation({
  args: { tokenHash: v.string(), workosUserId: v.string(), now: v.number() },
  handler: async (ctx, { tokenHash, workosUserId, now }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, {
      workosUserId,
      codeSentAt: now,
      codeSentCount: (session.codeSentCount ?? 0) + 1,
      state: "code",
      updatedAt: now,
    });
  },
});

export const advanceToOrganizationInternal = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, { state: "organization", updatedAt: Date.now() });
  },
});

export const recordCodeAttemptInternal = internalMutation({
  args: { tokenHash: v.string(), attempts: v.number(), now: v.number() },
  handler: async (ctx, { tokenHash, attempts, now }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, { codeAttempts: attempts, updatedAt: now });
  },
});

export const markEmailVerifiedInternal = internalMutation({
  args: { tokenHash: v.string(), now: v.number() },
  handler: async (ctx, { tokenHash, now }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, {
      workosEmailVerified: true,
      emailVerifiedAt: now,
      codeAttempts: 0,
      state: "organization",
      updatedAt: now,
    });
  },
});

export const markPasswordSetInternal = internalMutation({
  args: { tokenHash: v.string(), now: v.number() },
  handler: async (ctx, { tokenHash, now }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, {
      consentAt: now,
      passwordSetAt: now,
      state: "provisioning",
      updatedAt: now,
    });
  },
});

export const markProvisioningInternal = internalMutation({
  args: {
    tokenHash: v.string(),
    key: v.string(),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    error: v.optional(v.string()),
    ref: v.optional(v.string()),
  },
  handler: async (ctx, { tokenHash, key, startedAt, status, error, ref }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    const completedAt = status === "done" || status === "failed" ? Date.now() : undefined;
    const next = session.provisioning.map((entry) =>
      entry.key === key
        ? { key, label: entry.label, startedAt, status, error: error ?? undefined, ref: ref ?? undefined, completedAt }
        : entry,
    );
    if (!next.some((entry) => entry.key === key)) {
      next.push(provisioningStepEntry(key, startedAt, status, { completedAt, error, ref }));
    }
    await ctx.db.patch(session._id, {
      provisioning: next,
      state: "provisioning",
      updatedAt: Date.now(),
    });
  },
});

export const commitTenantInternal = internalMutation({
  args: {
    tokenHash: v.string(),
    slug: v.string(),
    companyName: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
    phone: v.string(),
    acquisitionSource: v.string(),
    workosOrganizationId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!session) throw new Error("Your sign-up session could not be found. Please start again.");
    if (!args.workosOrganizationId) throw new Error("Identity provisioning is incomplete.");
    if (!isValidSignupSlug(args.slug)) throw new Error("That workspace address is unavailable.");
    const platformRun = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .order("desc")
      .first();
    if (platformRun && platformRun.tenantId !== session.tenantId) {
      throw new Error("That workspace address is unavailable.");
    }
    const now = Date.now();
    let tenantId: Id<"tenants"> | undefined;
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existingTenant) {
      // A retry may encounter the tenant that this exact session committed.
      // Any other tenant is a race or collision and must never receive the
      // new sign-up's WorkOS organization or administrator membership.
      if (
        session.tenantId !== existingTenant._id ||
        existingTenant.workosOrganizationId !== args.workosOrganizationId
      ) {
        throw new Error("That workspace address is unavailable.");
      }
      tenantId = existingTenant._id;
    } else {
      tenantId = await ctx.db.insert("tenants", {
        slug: args.slug,
        name: args.companyName,
        country: args.country,
        timezone: args.timezone,
        currency: args.currency,
        status: "trial",
        workosOrganizationId: args.workosOrganizationId,
        phone: args.phone || undefined,
        acquisitionSource: args.acquisitionSource || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(session._id, {
      tenantId,
      workosOrganizationId: args.workosOrganizationId,
      updatedAt: now,
    });
    return { tenantId, organizationId: args.workosOrganizationId };
  },
});

/**
 * The public and platform-assisted onboarding paths share the workspace
 * namespace. This mutation is intentionally called before a public session
 * creates its WorkOS organization; it is the cross-flow reservation check.
 */
export const assertWorkspaceAvailableForSignup = internalMutation({
  args: { tokenHash: v.string(), slug: v.string() },
  handler: async (ctx, { tokenHash, slug }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session || session.slug !== slug) {
      throw new Error("Your sign-up session is no longer valid.");
    }
    if (!isValidSignupSlug(slug)) throw new Error("That workspace address is unavailable.");
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existingTenant && session.tenantId !== existingTenant._id) {
      throw new Error("That workspace address is unavailable.");
    }
    const platformRun = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .order("desc")
      .first();
    if (platformRun && platformRun.tenantId !== session.tenantId) {
      throw new Error("That workspace address is unavailable.");
    }
  },
});

export const commitAdminInternal = internalMutation({
  args: { tokenHash: v.string(), workosMembershipId: v.string() },
  handler: async (ctx, { tokenHash, workosMembershipId }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session || !session.tenantId) throw new Error("The workspace has not been created yet.");
    const tenantId = session.tenantId;
    const workosUserId = session.workosUserId;
    if (!workosUserId) throw new Error("The identity account is not configured yet.");
    const now = Date.now();
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
      .first();
    if (user?.deletedAt !== undefined || user?.isActive === false) {
      throw new Error("The administrator account is unavailable.");
    }
    let userId = user?._id;
    if (!userId) {
      userId = await ctx.db.insert("users", {
        workosUserId,
        name: `${session.firstName ?? ""} ${session.lastName ?? ""}`.trim(),
        email: session.email,
        emailVerificationTime: session.emailVerifiedAt,
        isActive: true,
      });
    }
    const existingMembership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", userId).eq("tenantId", tenantId))
      .first();
    let membershipId = existingMembership?._id;
    if (!membershipId) {
      membershipId = await ctx.db.insert("tenantMemberships", {
        userId,
        tenantId,
        role: "tenant_admin",
        status: "active",
        workosMembershipId,
        joinedAt: now,
      });
    } else {
      // WorkOS was checked as active by the action immediately before this
      // mutation. Keep the local authorization projection idempotent on a
      // retry so a stale pending/revoked mirror cannot strand the new owner.
      await ctx.db.patch(membershipId, {
        role: "tenant_admin",
        status: "active",
        workosMembershipId,
        joinedAt: existingMembership?.joinedAt ?? now,
        revokedAt: undefined,
      });
    }
    await ctx.db.patch(session._id, {
      workosMembershipId,
      updatedAt: now,
    });
    return { membershipId, userId };
  },
});

export const recordWelcomeInternal = internalMutation({
  args: { tokenHash: v.string(), tenantId: v.id("tenants"), tenantSlug: v.string(), email: v.string() },
  handler: async (ctx, { tokenHash, tenantId, tenantSlug, email }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session || !session.tenantId) throw new Error("The workspace has not been created yet.");
    const existing = await ctx.db
      .query("tenantWelcomeDeliveries")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();
    if (existing) {
      await ctx.db.patch(session._id, { welcomeDeliveryId: existing._id, updatedAt: Date.now() });
      return existing._id;
    }
    const id = await ctx.db.insert("tenantWelcomeDeliveries", {
      tenantId,
      tenantSlug: session.slug ?? tenantSlug,
      email: session.email ?? email,
      kind: "signup_confirmation",
      method: "workos",
      deliveredAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.patch(session._id, { welcomeDeliveryId: id, updatedAt: Date.now() });
    return id;
  },
});

export const finishProvisioningInternal = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const session = await ctx.db
      .query("signupSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!session) return;
    const now = Date.now();
    const provisioning = session.provisioning.map((entry) =>
      entry.status === "running"
        ? { ...entry, status: "done" as const, completedAt: entry.completedAt ?? now }
        : entry,
    );
    await ctx.db.patch(session._id, {
      state: "ready",
      provisioning,
      completedAt: now,
      updatedAt: now,
    });
  },
});
