/**
 * Server-side session facade for MylesNet.
 *
 * Builds on AuthKit's `getTokenClaims` (workforce identity) and the
 * `__mylesnet_*` cookie policy. This is the optimistic/server data layer: the
 * Convex guards in `convex/lib/auth.ts` remain the authority for any mutation.
 * All functions are async to match Next.js 16's async `cookies()`/authkit APIs.
 */

import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { TENANT_COOKIE_NAME, TENANT_COOKIE_MAX_AGE, baseCookieOptions } from "./cookies";
import { hasAnyRole, normalizeRoleClaims, toClaimArray } from "./rbac";

export class AuthRequiredError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class RoleRequiredError extends Error {
  readonly status = 403;
  constructor(roles: string[]) {
    super(`Unauthorized: one of role(s) ${roles.join(", ")} required.`);
    this.name = "RoleRequiredError";
  }
}

export interface AuthSession {
  workosUserId: string;
  email?: string;
  orgId?: string;
  roleSlugs: string[];
  permissions: string[];
  authenticatedAt?: Date;
}

/** Read and decode the current AuthKit token claims into a typed session. */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) return null;
    const roleSlugs = normalizeRoleClaims(claims.role, claims.roles);
    return {
      workosUserId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      orgId: typeof claims.org_id === "string" ? claims.org_id : undefined,
      roleSlugs,
      permissions: toClaimArray(claims.permissions),
      authenticatedAt:
        typeof claims.auth_time === "number" ? new Date(claims.auth_time * 1000) : undefined,
    };
  } catch {
    return null;
  }
}

/** Return the session or throw AuthRequiredError (route handlers / actions). */
export async function requireUser(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) throw new AuthRequiredError();
  return session;
}

/** Return the session only when the user holds at least one required role. */
export async function requireRole(requiredRoles: string[]): Promise<AuthSession> {
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, requiredRoles)) {
    throw new RoleRequiredError(requiredRoles);
  }
  return session;
}

/**
 * Resolve the active tenant slug for the request.
 *
 * Reads the `__mylesnet_tenant` cookie set by the proxy from the hostname.
 * A missing cookie is intentionally not mapped to any tenant. Convex derives
 * the authoritative tenant from the active WorkOS organization membership.
 */
export async function getActiveTenantSlug(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE_NAME)?.value;
}

/** Persist the tenant cookie (used by the proxy; opt-in callers). */
export async function setTenantCookie(slug: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, slug, baseCookieOptions({ httpOnly: true, maxAge: TENANT_COOKIE_MAX_AGE }));
}

/** Names of every MylesNet-owned cookie cleared on sign-out/expiry. */
export function mylesnetCookieNames(): string[] {
  return [TENANT_COOKIE_NAME];
}
