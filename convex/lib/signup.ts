/**
 * Pure validation and normalization helpers for the public sign-up wizard.
 *
 * This module is bundled by Convex, so it CANNOT import from `apps/web`.
 * The slug/domain contract is deliberately mirrored from
 * `apps/web/shared/auth/tenant.ts`; the parity test
 * `apps/web/shared/auth/convex-signup-consistency.test.ts` asserts both sides
 * agree so a future edit cannot silently drift them apart.
 */

import { v } from "convex/values";

export const MYLESNET_SIGNUP_SESSION_MAX_AGE_MS = 1000 * 60 * 60;
export const WORKOS_EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
export const WORKOS_EMAIL_CODE_MAX_ATTEMPTS = 8;

/** Canonical operator hostname (`tenant.<this>` is a tenant workspace). */
export const SIGNUP_HOST_DOMAIN = "mylesnetisp.mylescorptech.com";

/** Slug shape: 2-63 lowercase alphanumerics with optional single hyphens. */
export const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Slugs a self-service operator may never claim for its workspace host. */
export const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set<string>([
  "admin",
  "agency",
  "api",
  "auth",
  "blog",
  "dashboard",
  "help",
  "mail",
  "mylesnet",
  "network",
  "partner",
  "reseller",
  "support",
  "www",
]);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const COUNTRY_ISO2_RE = /^[A-Za-z]{2}$/;
export const CURRENCY_ISO3_RE = /^[A-Za-z]{3}$/;
export const PHONE_RE = /^\+?[0-9 ()-]{4,20}$/;

export const MIN_PASSWORD_LENGTH = 10;

/** Full policy: at least 10 chars with upper, lower, digit, and a symbol. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

export interface PasswordRequirements {
  metLength: boolean;
  metLower: boolean;
  metUpper: boolean;
  metDigit: boolean;
  metSymbol: boolean;
}

export function passwordRequirements(password: string): PasswordRequirements {
  return {
    metLength: password.length >= MIN_PASSWORD_LENGTH,
    metLower: /[a-z]/.test(password),
    metUpper: /[A-Z]/.test(password),
    metDigit: /\d/.test(password),
    metSymbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function isValidPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}

/** 0-4 strength used by the strength meter (server enforces the full policy). */
export function passwordStrength(password: string): number {
  const reqs = passwordRequirements(password);
  let score = 0;
  if (reqs.metLength) score += 1;
  if (reqs.metLower && reqs.metUpper) score += 1;
  if (reqs.metDigit) score += 1;
  if (reqs.metSymbol) score += 1;
  return score;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Names allow letters (incl. accented), spaces, and '. - ''. */
export function isValidDisplayName(name: string): boolean {
  const value = normalizeDisplayName(name);
  return value.length >= 2 && value.length <= 100 && /^[\p{L}][\p{L}\s.'-]*$/u.test(value);
}

export function normalizeOperatorName(name: string): string {
  return normalizeDisplayName(name);
}

export function isValidBusinessName(name: string): boolean {
  const value = normalizeBusinessName(name);
  return value.length >= 2 && value.length <= 120;
}

export function normalizeBusinessName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Normalize a draft slug to its closest valid form: lowercase, collapse runs
 * of separators to a single hyphen, keep alphanumerics, drop trailing hyphen.
 */
export function normalizeSlug(input: string): string {
  const value = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return value.slice(0, 63);
}

export function isValidSignupSlug(slug: string | null | undefined): slug is string {
  if (typeof slug !== "string") return false;
  if (slug.length < 2 || slug.length > 63) return false;
  if (RESERVED_TENANT_SLUGS.has(slug)) return false;
  if (!TENANT_SLUG_RE.test(slug)) return false;
  if (/^\d+$/.test(slug)) return false;
  return true;
}

export function isValidCountryCode(code: string): boolean {
  return COUNTRY_ISO2_RE.test(code);
}

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_ISO3_RE.test(code);
}

export function isValidTimezone(tz: string): boolean {
  return typeof tz === "string" && tz.length <= 64 && /^[A-Za-z_+\-/0-9]+$/.test(tz);
}

export function sanitizePhone(phone: string): string {
  return phone.trim();
}

export function isValidPhone(phone: string | undefined | null): boolean {
  if (!phone) return true;
  return PHONE_RE.test(sanitizePhone(phone));
}

/** Data-driven acquisition-source options for the operating-defaults step. */
export const SIGNUP_REFERRAL_SOURCES = [
  { value: "search", label: "Search engine" },
  { value: "social", label: "Social media" },
  { value: "friend", label: "Friend or colleague" },
  { value: "advertisement", label: "Online advert" },
  { value: "conference", label: "Conference or event" },
  { value: "reseller", label: "Reseller or partner" },
  { value: "recommendation", label: "MylesNet recommendation" },
] as const;

export type SignupReferralSource = (typeof SIGNUP_REFERRAL_SOURCES)[number]["value"];

export const SIGNUP_REFERRAL_VALUES: ReadonlySet<string> = new Set<string>(
  SIGNUP_REFERRAL_SOURCES.map((source) => source.value),
);

export function isValidReferralSource(value: string | null | undefined): value is SignupReferralSource {
  return typeof value === "string" && SIGNUP_REFERRAL_VALUES.has(value);
}

/** Provisioning step catalogue, in execution order (spec §12 provisioning). */
export const SIGNUP_PROVISIONING_STEPS = [
  { key: "accountAddress", label: "Creating your account address" },
  { key: "adminAccount", label: "Creating your admin account" },
  { key: "welcomeEmail", label: "Sending your welcome email" },
  { key: "ready", label: "Account ready" },
] as const;

export type SignupProvisioningStepKey = (typeof SIGNUP_PROVISIONING_STEPS)[number]["key"];

export const SIGNUP_PROVISIONING_STEP_KEYS: ReadonlySet<string> = new Set<string>(
  SIGNUP_PROVISIONING_STEPS.map((step) => step.key),
);

/** Type describing one provisioning attempt (used by schema + handlers). */
export const provisioningAttemptValidator = v.object({
  key: v.string(),
  label: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
  error: v.optional(v.string()),
  ref: v.optional(v.string()),
});