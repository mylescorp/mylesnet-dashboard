import { action, query, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePlatformOwner } from "./lib/auth";

function platformOrganizationId(): string {
  const organizationId = process.env.MYLESNET_PLATFORM_ORG_ID;
  if (!organizationId) throw new Error("Platform organization is not configured");
  return organizationId;
}

/** Public alias for role/invitation sync users. */
export function platformOrganizationIdForRoleSync(): string {
  return platformOrganizationId();
}

// WorkOS role slugs in the MylesNet environment. These are emitted verbatim
// as the JWT `role` claim and must match the codebase `PlatformRole` values.
type WorkosRoleName =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "agent";

export type { WorkosRoleName };

function workosAuth() {
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY is not configured");
  }
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

const WORKOS_API = "https://api.workos.com";

async function workosFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${WORKOS_API}${path}`, {
    ...init,
    headers: { ...workosAuth(), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `WorkOS request failed with status ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

type WorkosMembership = {
  id: string;
  organization_id: string;
  status: string;
};

async function getPlatformMembership(workosUserId: string): Promise<WorkosMembership | null> {
  const payload = (await workosFetch(
    `/user_management/organization_memberships` +
      `?organization_id=${encodeURIComponent(platformOrganizationId())}` +
      `&user_id=${encodeURIComponent(workosUserId)}` +
      `&statuses=active,inactive`,
  )) as { data?: WorkosMembership[] };
  return payload.data?.[0] ?? null;
}

/** Update a user's WorkOS role within the configured platform organization. */
export async function setWorkosUserRole(workosUserId: string, role: WorkosRoleName | string): Promise<void> {
  const membership = await getPlatformMembership(workosUserId);
  if (!membership) throw new Error("Target account is not assigned to this workspace");
  await workosFetch(
    `/user_management/organization_memberships/${encodeURIComponent(membership.id)}`,
    { method: "PUT", body: JSON.stringify({ role_slug: role }) },
  );
}

/** Deactivate a user's platform organization membership (revokes sessions). */
export async function deactivateWorkosMembership(workosUserId: string): Promise<void> {
  const membership = await getPlatformMembership(workosUserId);
  if (!membership) throw new Error("Target account is not assigned to this workspace");
  if (membership.status !== "active") return;
  await workosFetch(
    `/user_management/organization_memberships/${encodeURIComponent(membership.id)}/deactivate`,
    { method: "PUT" },
  );
}

/** Reactivate a user's platform organization membership. */
export async function reactivateWorkosMembership(workosUserId: string): Promise<void> {
  const membership = await getPlatformMembership(workosUserId);
  if (!membership) throw new Error("Target account is not assigned to this workspace");
  if (membership.status === "active") return;
  await workosFetch(
    `/user_management/organization_memberships/${encodeURIComponent(membership.id)}/reactivate`,
    { method: "PUT" },
  );
}

export interface WorkosEnvironmentRole {
  id: string;
  slug: string;
  name: string;
}

/** List the environment-level roles (the ones the JWT `role` claim can emit). */
export async function getWorkosEnvironmentRoles(): Promise<WorkosEnvironmentRole[]> {
  const payload = (await workosFetch("/user_management/roles")) as {
    data?: Array<{ id?: unknown; slug?: unknown; name?: unknown }>;
  };
  return (payload.data ?? [])
    .filter((role) => typeof role.id === "string" && typeof role.slug === "string")
    .map((role) => ({
      id: role.id as string,
      slug: role.slug as string,
      name: typeof role.name === "string" ? role.name : role.slug as string,
    }));
}

/** Create an environment-level permission if it does not exist yet (idempotent). */
export async function ensureWorkosPermission(slug: string, name: string): Promise<void> {
  try {
    await workosFetch("/authorization/permissions", {
      method: "POST",
      body: JSON.stringify({ slug, name }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Slug collisions are fine — the permission already exists with that slug.
    if (!/already exists|already in use|duplicate|conflict/i.test(message)) throw error;
  }
}

/** Create an organization-scoped custom role (slug must carry the org- prefix). */
export async function createWorkosOrganizationRole(
  organizationId: string,
  slug: string,
  name: string,
  description?: string,
): Promise<string> {
  const payload = (await workosFetch(
    `/authorization/organizations/${encodeURIComponent(organizationId)}/roles`,
    {
      method: "POST",
      body: JSON.stringify({ slug, name, description }),
    },
  )) as { id?: unknown };
  if (typeof payload.id !== "string") throw new Error("WorkOS did not return a role id");
  return payload.id;
}

export async function updateWorkosOrganizationRole(
  organizationId: string,
  slug: string,
  name: string,
  description?: string,
): Promise<void> {
  await workosFetch(
    `/authorization/organizations/${encodeURIComponent(organizationId)}/roles/${encodeURIComponent(slug)}`,
    { method: "PATCH", body: JSON.stringify({ name, description }) },
  );
}

export async function deleteWorkosOrganizationRole(
  organizationId: string,
  slug: string,
): Promise<void> {
  await workosFetch(
    `/authorization/organizations/${encodeURIComponent(organizationId)}/roles/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

/** Replace all permissions assigned to an organization-scoped role. */
export async function setWorkosOrganizationRolePermissions(
  organizationId: string,
  slug: string,
  permissions: string[],
): Promise<void> {
  await workosFetch(
    `/authorization/organizations/${encodeURIComponent(organizationId)}/roles/${encodeURIComponent(slug)}/permissions`,
    { method: "PUT", body: JSON.stringify({ permissions }) },
  );
}

export interface WorkosInvitation {
  id: string;
  email: string;
  organization_id: string | null;
  role_slug: string | null;
  state: string;
  expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
}

/** Invite a user, auto-allocating them to the platform organization. */
export async function createWorkosInvitation(
  email: string,
  organizationId: string,
  roleSlug: string,
  expiresInDays = 7,
): Promise<WorkosInvitation> {
  const payload = (await workosFetch("/user_management/invitations", {
    method: "POST",
    body: JSON.stringify({
      email,
      organization_id: organizationId,
      role_slug: roleSlug,
      expires_in_days: expiresInDays,
    }),
  })) as {
    id?: unknown;
    email?: unknown;
    organization_id?: unknown;
    role_slug?: unknown;
    state?: unknown;
    expires_at?: unknown;
    accepted_at?: unknown;
    revoked_at?: unknown;
  };
  if (typeof payload.id !== "string") throw new Error("WorkOS did not return an invitation id");
  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : email,
    organization_id: typeof payload.organization_id === "string" ? payload.organization_id : null,
    role_slug: typeof payload.role_slug === "string" ? payload.role_slug : null,
    state: typeof payload.state === "string" ? payload.state : "pending",
    expires_at: typeof payload.expires_at === "string" ? payload.expires_at : null,
    accepted_at: typeof payload.accepted_at === "string" ? payload.accepted_at : null,
    revoked_at: typeof payload.revoked_at === "string" ? payload.revoked_at : null,
  };
}

export async function revokeWorkosInvitation(invitationId: string): Promise<void> {
  await workosFetch(
    `/user_management/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST" },
  );
}

/** Look up an existing WorkOS user by email; returns null when absent. */
export async function getWorkosUserByEmail(email: string): Promise<string | null> {
  const payload = (await workosFetch(
    `/user_management/users?email=${encodeURIComponent(email.toLowerCase().trim())}`,
  )) as { data?: Array<{ id?: unknown }> };
  const first = (payload.data ?? []).find((user) => typeof user.id === "string");
  return first && typeof first.id === "string" ? first.id : null;
}

/**
 * Ensure a WorkOS user exists for the given email, creating it when missing.
 * Directory-managed users authenticate through the same AuthKit flows.
 */
export async function createWorkosUser(email: string): Promise<string> {
  const existing = await getWorkosUserByEmail(email);
  if (existing) return existing;
  const payload = (await workosFetch("/user_management/users", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { id?: unknown };
  if (typeof payload.id !== "string") throw new Error("WorkOS did not return a user id");
  return payload.id;
}

/** Add a user to an organization with an optional role slug. Returns the new membership id. */
export async function addWorkosOrganizationMembership(
  organizationId: string,
  workosUserId: string,
  roleSlug?: string,
): Promise<string | null> {
  const body: Record<string, string> = {
    organization_id: organizationId,
    user_id: workosUserId,
  };
  if (roleSlug) body.role_slug = roleSlug;
  const payload = (await workosFetch("/user_management/organization_memberships", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { id?: unknown };
  return typeof payload.id === "string" ? payload.id : null;
}

/**
 * Look up the caller's active organization membership in WorkOS, so callers
 * can mutate their own role. Throws if the user isn't a member of an org.
 */
async function getOwnMembership(ctx: ActionCtx): Promise<{
  membershipId: string;
  organizationId: string;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const membership = await getPlatformMembership(identity.subject);
  if (!membership || membership.status !== "active") {
    throw new Error("Not a member of any organization");
  }
  return { membershipId: membership.id, organizationId: membership.organization_id };
}

/** Set the caller's WorkOS organization membership role. */
export async function setOwnWorkosRole(ctx: ActionCtx, role: WorkosRoleName | string): Promise<void> {
  const { organizationId } = await getOwnMembership(ctx);
  if (organizationId !== platformOrganizationId()) {
    throw new Error("Unauthorized organization membership");
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  await setWorkosUserRole(identity.subject, role);
}

/**
 * Ensures the authenticated WorkOS user is a member of the MylesNet Platform
 * organization. Called after first login. Idempotent — safe to call repeatedly.
 *
 * New non-owner users are added to the MylesNet Platform org with the
 * platform_admin role. This action calls the WorkOS API directly to create
 * the org membership, which causes WorkOS to include organization_id and
 * role in future JWTs.
 */
export const ensureOrgMembership = action({
  args: {},
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return { status: "unauthenticated" as const };
      }

      // A dashboard must never grant itself a privileged membership. WorkOS is
      // authoritative: accounts are invited by an owner outside this action.
      const orgId = identity["organization_id"];
      if (orgId && orgId === platformOrganizationId()) {
        await ctx.runMutation(internal.platformUsers.syncWorkosIdentity, {
          workosUserId: identity.subject,
          email: identity.email,
          name: typeof identity.name === "string" ? identity.name : undefined,
          image: typeof identity.picture === "string" ? identity.picture : undefined,
        });
        return { status: "already_member" as const, organizationId: orgId as string };
      }
      return { status: "not_member" as const };
    } catch {
      return { status: "error" as const, reason: "Identity synchronization could not be completed" };
    }
  },
});

/** Owner-only readiness information. No organization ID or secret is returned. */
export const getIntegrationReadiness = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    return {
      platformOrganizationConfigured: Boolean(process.env.MYLESNET_PLATFORM_ORG_ID),
      bootstrapAllowlistConfigured: Boolean(process.env.MYLESNET_BOOTSTRAP_OWNER_EMAILS),
    };
  },
});