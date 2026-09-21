import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import {
  SYSTEM_ROLE_SLUGS,
  getSystemRoleBySlug,
  PLATFORM_SUB_ROLE_MAP,
  TENANT_ROLE_PERMISSIONS,
  tenantRoleHasPermission,
} from "./permissions";
import { assertMfaCompliance as assertMfaCompliancePolicy } from "./mfa";
import { canTenantOperate } from "./tenantCore";
import { organizationIdFromWorkosIdentity } from "./workosIdentity";

/**
 * Platform role access is data-driven from the `roles` table via
 * `users.roles[]`.
 *
 * During migration a user whose `roles[]` is empty falls back to the legacy
 * `platformRole` mirror, so nothing is locked out before the backfill runs.
 * Once backfilled, `users.roles[]` is authoritative — the mirror only feeds
 * the one-shot owner claim checks.
 */

// Kept for legacy call sites until the platformRole mirror is removed.
export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "agent";

export interface ResolvedRole {
  _id: Id<"roles"> | null;
  slug: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isPlatform: boolean;
  rank: number;
  permissions: string[];
}

export function systemRoleName(slug: string): string {
  return getSystemRoleBySlug(slug)?.name ?? slug.replace(/_/g, " ");
}

/** Build a read-model role from a stored role row. */
export function resolveRoleRow(row: Doc<"roles">): ResolvedRole {
  return {
    _id: row._id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isPlatform: row.isPlatform,
    rank: row.rank,
    permissions: row.permissions,
  };
}

/** Virtual fallback role for a user who has not been backfilled yet. */
function virtualRole(slug: string): ResolvedRole {
  const system = getSystemRoleBySlug(slug);
  return {
    _id: null,
    slug,
    name: system?.name ?? slug.replace(/_/g, " "),
    isSystem: true,
    isPlatform: system?.isPlatform ?? false,
    rank: system?.rank ?? 0,
    permissions: system?.permissions ?? [],
  };
}

/**
 * Resolve the roles currently assigned to a user.
 *
 * Prefers `user.roles[]`; falls back to the `platformRole` mirror while the
 * backfill has not populated the array. Empty `roles[]` with no mirror yields
 * nothing. A user must never gain an implicit operational role merely because
 * a legacy backfill has not assigned one yet.
 */
export async function resolveRoles(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<ResolvedRole[]> {
  if (user.deletedAt !== undefined) return [];
  const roleIds = user.roles;
  if (roleIds && roleIds.length > 0) {
    const rows = await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId)));
    return rows
      .filter((row): row is Doc<"roles"> => row !== null && row.deletedAt === undefined)
      .map(resolveRoleRow);
  }
  if (user.platformRole !== undefined && user.platformRole !== null) {
    return [virtualRole(user.platformRole)];
  }
  return [];
}

/**
 * Resolve a tenant membership only from the active WorkOS organization claim.
 * Unknown organizations and inactive memberships fail closed.
 */
async function getActiveTenantMembership(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const organizationId = organizationIdFromWorkosIdentity(identity);
  if (!organizationId) return null;
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", organizationId))
    .first();
  if (!tenant || !canTenantOperate(tenant.status)) return null;
  const membership = await ctx.db
    .query("tenantMemberships")
    .withIndex("by_user_tenant", (q) => q.eq("userId", user._id).eq("tenantId", tenant._id))
    .first();
  return membership?.status === "active" ? membership : null;
}

export async function resolveTenantAccess(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const membership = await getActiveTenantMembership(ctx, user);
  if (!membership) return null;
  return {
    tenantId: membership.tenantId,
    role: membership.role,
    permissions: [...(TENANT_ROLE_PERMISSIONS[membership.role] ?? [])],
  };
}

export function tenantRoleAsResolvedRole(role: string): ResolvedRole {
  return {
    _id: null,
    slug: role,
    name: role.replace(/^tenant_/, "").replace(/_/g, " "),
    isSystem: true,
    isPlatform: false,
    rank: 0,
    permissions: [...(TENANT_ROLE_PERMISSIONS[role] ?? [])],
  };
}

/**
 * Require a permission inside the caller's active, mapped tenant workspace.
 * Platform permissions never substitute for this check, so a tenant endpoint
 * cannot be reached by changing only a URL or client-supplied tenant id.
 */
export async function requireTenantPermission(
  ctx: QueryCtx | MutationCtx,
  permission: string,
): Promise<{ user: Doc<"users">; tenantId: Id<"tenants"> }> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const membership = await getActiveTenantMembership(ctx, user);
  if (!membership || !tenantRoleHasPermission(membership.role, permission)) {
    throw new Error(`Unauthorized: the ${permission} permission is required`);
  }
  return { user, tenantId: membership.tenantId };
}

export function hasPermission(
  roles: ResolvedRole[],
  permission: string,
): boolean {
  return roles.some((role) => role.permissions.includes(permission));
}

export function permissionsOf(roles: ResolvedRole[]): string[] {
  const seen = new Set<string>();
  for (const role of roles) {
    for (const permission of role.permissions) seen.add(permission);
  }
  return Array.from(seen);
}

export function isPlatformUser(roles: ResolvedRole[]): boolean {
  return roles.some((role) => role.isPlatform);
}

export function isPlatformOwner(roles: ResolvedRole[]): boolean {
  return roles.some((role) => role.slug === "platform_owner");
}

export function isPlatformAdmin(roles: ResolvedRole[]): boolean {
  return roles.some(
    (role) => role.slug === "platform_owner" || role.slug === "platform_admin",
  );
}

/** Require any authenticated platform user (owner/admin/support). */
export async function requirePlatformUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isPlatformUser(roles)) {
    throw new Error("Unauthorized: platform access required");
  }
  return user;
}

/** Require platform_owner or platform_admin. */
export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isPlatformAdmin(roles)) {
    throw new Error("Unauthorized: admin role required");
  }
  assertMfaCompliancePolicy(user, roles.map((role) => role.slug));
  return user;
}

/** Require platform_owner. */
export async function requirePlatformOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isPlatformOwner(roles)) {
    throw new Error("Unauthorized: owner role required");
  }
  assertMfaCompliancePolicy(user, roles.map((role) => role.slug));
  return user;
}

/** Require the caller to hold any one of the given role slugs. */
export async function requireAnyRole(
  ctx: QueryCtx | MutationCtx,
  slugs: string[],
): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!slugs.some((slug) => roles.some((role) => role.slug === slug))) {
    throw new Error("Unauthorized: insufficient role");
  }
  return user;
}

/** Operations lead + above (owner / admin / ops_manager). */
export function isOpsOrAbove(roles: ResolvedRole[]): boolean {
  return roles.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );
}

export async function requireOpsOrAbove(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isOpsOrAbove(roles)) {
    throw new Error("Unauthorized: operations role required");
  }
  return user;
}

/** Finance lead + above (owner / admin / finance_manager). */
export function isFinanceOrAbove(roles: ResolvedRole[]): boolean {
  return roles.some((role) =>
    ["platform_owner", "platform_admin", "finance_manager"].includes(role.slug),
  );
}

export async function requireFinanceOrAbove(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isFinanceOrAbove(roles)) {
    throw new Error("Unauthorized: finance role required");
  }
  return user;
}

/** Investor read-only view (investor_viewer role; investors may self-serve later). */
export async function requireInvestorViewer(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (!isFinanceOrAbove(roles) && !roles.some((role) => role.slug === "investor_viewer")) {
    throw new Error("Unauthorized: investor access required");
  }
  return user;
}

/** Require the caller to hold a specific permission. Returns the user record. */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: string,
): Promise<Doc<"users">> {
  const user = await getCurrentUserRecord(ctx);
  if (user.isActive === false || user.deactivatedAt !== undefined) {
    throw new Error("Unauthorized: account is inactive");
  }
  const roles = await resolveRoles(ctx, user);
  if (hasPermission(roles, permission) && isPlatformUser(roles)) return user;

  // Tenant permissions exist only within the active organization mapped to a
  // real tenant. They never satisfy a platform-role guard.
  const tenantMembership = await getActiveTenantMembership(ctx, user);
  if (tenantRoleHasPermission(tenantMembership?.role, permission)) return user;

  throw new Error(`Unauthorized: the ${permission} permission is required`);
}

/** Any authenticated user (works from actions too). */
export async function requireAuthenticatedUser(
  ctx: ActionCtx | QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  // Actions cannot read the database directly, so they can only assert that the
  // caller is authenticated (their existing callers don't use the returned id).
  if (!("db" in ctx)) {
    return identity.subject as Id<"users">;
  }

  const user = await resolveUserByIdentity(ctx);
  if (!user || !isActiveUser(user)) throw new Error("Unauthenticated");
  return user._id;
}

/** Network Operations is a module inside the platform, not a second auth realm. */
export async function requireNetworkOperator(ctx: QueryCtx | MutationCtx) {
  return requirePlatformUser(ctx);
}

export async function requireMarketAccess(
  ctx: QueryCtx | MutationCtx,
  marketId: Id<"markets">,
  minimumRole: "manager" | "operator" | "viewer" = "viewer",
) {
  const user = await getCurrentUserRecord(ctx);
  if (!isActiveUser(user)) throw new Error("Unauthorized: account is inactive");
  const roles = await resolveRoles(ctx, user);
  if (isPlatformAdmin(roles)) return user;
  const membership = await ctx.db
    .query("userMarketMemberships")
    .withIndex("by_user_and_market", (q) => q.eq("userId", user._id).eq("marketId", marketId))
    .first();
  const rank = { viewer: 1, operator: 2, manager: 3 } as const;
  if (!membership || membership.revokedAt !== undefined || rank[membership.role] < rank[minimumRole]) {
    throw new Error("Unauthorized: market access required");
  }
  return user;
}

/** Commission payout self-approval guard */
export function assertNotSelfApproval(
  requestedBy: Id<"users"> | undefined,
  approverUserId: Id<"users">,
  approverRole: PlatformRole | undefined
) {
  if (approverRole === "platform_owner") return;
  if (requestedBy && requestedBy === approverUserId) {
    throw new Error(
      "Unauthorized: cannot approve a commission payout you requested yourself"
    );
  }
}

/**
 * Resolve the authenticated user's record by identity.
 *
 * The platform stores users in Convex with a Convex-generated `_id`, but under
 * WorkOS AuthKit the auth identity `subject` is a WorkOS user id (user_...),
 * which is NOT a valid Convex `users._id`. So we match on the WorkOS id first,
 * then fall back to the identity email.
 */
export async function resolveUserByIdentity(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const byWorkosId = await ctx.db
    .query("users")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
    .first();
  if (byWorkosId) return byWorkosId;
  if (!identity.email) return null;
  const email = identity.email.toLowerCase();
  return (await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first()) ?? null;
}

async function getCurrentUserRecord(ctx: QueryCtx | MutationCtx) {
  const user = await resolveUserByIdentity(ctx);
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return user;
}

function isActiveUser(user: Doc<"users">): boolean {
  return user.isActive !== false && user.deactivatedAt === undefined;
}

/**
 * Require the caller to hold at least one of the specified platform sub-roles.
 *
 * Sub-role slugs use the spec naming convention (platform_super_admin, platform_ops,
 * etc.) and are mapped to the actual role slugs seeded in the roles table. This
 * helper wraps `requireAnyRole` with the mapping layer; unknown slugs pass through
 * unchanged so literal slugs also work.
 *
 * The mapping is defined in lib/permissions.ts (PLATFORM_SUB_ROLE_MAP):
 *   platform_super_admin → platform_owner, platform_admin
 *   platform_ops         → ops_manager
 *   platform_finance     → finance_manager
 *   platform_support     → platform_support
 *   platform_readonly    → platform_readonly
 */
export async function requirePlatformSubRole(
  ctx: QueryCtx | MutationCtx,
  allowedSubRoles: string[],
): Promise<Doc<"users">> {
  const mappedSlugs = allowedSubRoles
    .flatMap((sub) => PLATFORM_SUB_ROLE_MAP[sub] ?? [sub])
    .filter((slug, index, arr) => arr.indexOf(slug) === index);
  return requireAnyRole(ctx, mappedSlugs);
}

/**
 * Enforce the mandatory-2FA policy (lib/mfa). WorkOS owns enrollment; this is
 * the app-side fail-closed check on the synced marker. Ops can dial it to
 * shadow mode via env flags (RBAC shadow mode, doc 06); the default is full
 * enforcement.
 */
/** Keep the system role slugs reachable from auth consumers. */
export { SYSTEM_ROLE_SLUGS };
