import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { isPlatformUser, resolveRoles, resolveUserByIdentity } from "./auth";
import { assertNoClientOverride, assertTenantMatch, canTenantOperate } from "./tenantCore";
import { organizationIdFromWorkosIdentity } from "./workosIdentity";

export {
  assertNoClientOverride,
  assertTenantMatch,
  isClientTenantOverride,
  decideTenantAccess,
  isTenantActive,
  isTenantSuspended,
  canTenantOperate,
} from "./tenantCore";

/** Reserved legacy slug retained only for the one-time migration utility. */
export const BOOTSTRAP_TENANT_SLUG = "mylesnet";

/**
 * Phase 1 tenant resolution layer (X-TEN §B1, §B5).
 *
 * The server derives a tenant from the caller's WorkOS identity
 * (`identity["org_id"]`), matched against `tenants.workosOrganizationId`.
 * An unmapped organization is never attached to a bootstrap or arbitrary
 * tenant. Client-supplied tenant ids remain inert.
 */

export interface ReadScope {
  /** Resolved tenant for the caller, or null for a Platform control-plane user. */
  tenantId: Id<"tenants"> | null;
  /** False only for an explicit Platform role. */
  enforced: boolean;
}

/**
 * Resolve tenant reads from the active WorkOS organization. Tenant users are
 * always filtered by an active membership; only a Platform role may use an
 * explicit control-plane reader without a tenant filter.
 */
export async function readScopedTenant(ctx: QueryCtx | MutationCtx): Promise<ReadScope> {
  const user = await resolveUserByIdentity(ctx);
  if (!user) throw new Error("Unauthenticated");
  if (isPlatformUser(await resolveRoles(ctx, user))) return { tenantId: null, enforced: false };
  const tenantId = await requireTenantMember(ctx);
  return { tenantId, enforced: true };
}

/**
 * Collect tenant-owned rows through the active membership scope. Rows without
 * a tenantId are legacy data and are never exposed to tenant users.
 */
export async function readTenantList<T>(
  ctx: QueryCtx,
  load: {
    all: () => Promise<T[]>;
    tenant: (tenantId: Id<"tenants">) => Promise<T[]>;
    legacy: () => Promise<T[]>;
  },
): Promise<T[]> {
  const scope = await readScopedTenant(ctx);
  if (!scope.enforced) return load.all();
  return load.tenant(scope.tenantId!);
}

/**
 * Single-resource read gate. A tenant resource must belong to the active
 * tenant; legacy unscoped resources are not tenant-readable.
 */
export async function enforceTenantOnResource<T extends { tenantId?: Id<"tenants"> | null }>(
  ctx: QueryCtx,
  resource: T | null,
  label: string,
): Promise<T | null> {
  const scope = await readScopedTenant(ctx);
  if (!scope.enforced) return resource;
  if (!resource) return null;
  if (resource.tenantId === undefined || resource.tenantId === null) {
    throw new Error(`Unauthorized: ${label} is not assigned to the active tenant`);
  }
  assertTenantMatch(scope.tenantId, resource.tenantId, label);
  return resource;
}

/**
 * Resolve the authenticated caller's tenant id, or null when no tenancy is
 * established yet. Never reads a `tenantId` from client input.
 */
export async function resolveTenantFromAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"tenants"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // Primary path: WorkOS per-tenant org claim (Phase 2 wiring, additive today).
  const orgId = organizationIdFromWorkosIdentity(identity);
  let organizationTenantId: Id<"tenants"> | null = null;
  if (typeof orgId === "string" && orgId.length > 0) {
    const byOrg = await ctx.db
      .query("tenants")
      .withIndex("by_workosOrganizationId", (q) =>
        q.eq("workosOrganizationId", orgId),
      )
      .first();
    organizationTenantId = byOrg?._id ?? null;
  }

  // Never fall back to a bootstrap or arbitrary tenant. An unresolved identity
  // must be denied by the caller rather than silently attached to another ISP.
  return organizationTenantId;
}

/**
 * Require an active membership in the resolved (or explicitly passed) tenant,
 * and that the tenant is not suspended/cancelled. Pass a `tenantId` only when
 * the caller already validated it server-side.
 */
export async function requireTenantMember(
  ctx: QueryCtx | MutationCtx,
  tenantId?: Id<"tenants">,
): Promise<Id<"tenants">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const target = tenantId ?? (await resolveTenantFromAuth(ctx));
  if (!target) throw new Error("Unauthorized: tenancy not configured for this identity");

  const tenant = await ctx.db.get(target);
  if (!tenant || !canTenantOperate(tenant.status)) {
    throw new Error("Unauthorized: tenant is suspended or cancelled");
  }

  const user = await resolveUserByIdentity(ctx);
  if (!user) throw new Error("Unauthenticated");
  if (user.deletedAt !== undefined || user.isActive === false) {
    throw new Error("Unauthorized: account is inactive");
  }

  const membership = await ctx.db
    .query("tenantMemberships")
    .withIndex("by_user_tenant", (q) => q.eq("userId", user._id).eq("tenantId", target))
    .first();
  if (!membership || membership.status !== "active") {
    throw new Error("Unauthorized: tenant membership required");
  }
  return target;
}

/**
 * Wrap a tenant-owned operation. Resolves the actor tenancy, refuses a
 * client-supplied override, and (optionally) asserts the resource is owned by
 * the actor's tenant. Pure decisions are delegated to tenantCore so they are
 * covered by node:test.
 */
export async function withTenantScope<T>(
  ctx: QueryCtx | MutationCtx,
  args: {
    resourceLabel: string;
    clientSuppliedTenantId?: Id<"tenants"> | null;
    resourceTenantId?: Id<"tenants"> | null;
  },
  fn: (tenantId: Id<"tenants">) => Promise<T>,
): Promise<T> {
  const resolved = await resolveTenantFromAuth(ctx);
  if (!resolved) throw new Error("Unauthorized: tenancy not configured for this identity");

  const tenant = await ctx.db.get(resolved);
  if (!tenant || !canTenantOperate(tenant.status)) {
    throw new Error("Unauthorized: tenant is suspended or cancelled");
  }

  assertNoClientOverride(resolved, args.clientSuppliedTenantId, args.resourceLabel);
  if (args.resourceTenantId !== undefined) {
    assertTenantMatch(resolved, args.resourceTenantId, args.resourceLabel);
  }
  return fn(resolved);
}
