import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { resolveUserByIdentity } from "./auth";
import { TENANT_FEATURE_FLAGS } from "./tenantMigration";
import { assertNoClientOverride, assertTenantMatch, canTenantOperate, resolvedTenantOrNull } from "./tenantCore";

export {
  assertNoClientOverride,
  assertTenantMatch,
  isClientTenantOverride,
  decideTenantAccess,
  isTenantActive,
  isTenantSuspended,
  canTenantOperate,
} from "./tenantCore";

/**
 * Phase 1 tenant resolution layer (X-TEN §B1, §B5).
 *
 * The server derives a tenant from the caller's WorkOS identity
 * (`identity.organizationId`), matched against `tenants.workosOrganizationId`.
 * During the additive migration — before the Phase 2 three-scope WorkOS model
 * backfills org mappings — the resolver falls back to the single bootstrap
 * tenant (`slug: "mylesnet"`), returning null when no tenants exist yet. That
 * is by design: nothing that requires a tenant may run until the bootstrap
 * tenant + backfill have landed, and client-supplied tenant ids remain inert.
 */

/** Reserved bootstrap slug used by the additive migration (see migration plan). */
export const BOOTSTRAP_TENANT_SLUG = "mylesnet";

/** Read a JSON-string stage flag from system_settings (missing = off). */
export async function isTenantStageFlagOn(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("system_settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.valueJson === "true";
}

export interface ReadScope {
  /** Resolved tenant for the caller, or null when enforcement is off. */
  tenantId: Id<"tenants"> | null;
  /** False while tenant.readPath is off: handlers keep current behavior. */
  enforced: boolean;
}

/**
 * Resolve the tenant scope for a read handler. Flags gate the additive
 * migration: while `tenant.readPath` is OFF this returns `{ tenantId: null,
 * enforced: false }` so every handler keeps its exact current behavior. The
 * moment the flag flips, reads narrow to the caller's tenant (membership
 * required) and legacy rows keyed `tenantId: undefined` — only reachable
 * through the `by_tenant` index on that state — pass through unchanged.
 *
 * Handlers apply indexed tenant filtering via the `by_tenant` index added in
 * the schema cohort, never by scanning the whole table.
 */
export async function readScopedTenant(ctx: QueryCtx | MutationCtx): Promise<ReadScope> {
  const enforced = await isTenantStageFlagOn(ctx, TENANT_FEATURE_FLAGS.readPath);
  if (!enforced) return { tenantId: null, enforced: false };
  const tenantId = await requireTenantMember(ctx);
  return { tenantId, enforced: true };
}

/**
 * Collect a tenant-owned table's rows through the read-path scope. When
 * enforcement is off this calls `load.all` (a plain full-table scan — current
 * behavior, bit for bit); when on it merges the tenant's rows (`by_tenant`
 * index match) with legacy rows whose `tenantId` is still undefined
 * (pre-backfill pass-through). Both enforcement branches are indexed — never a
 * full scan of the tenant partition. Loaders are provided per table so the
 * `by_tenant` index is type-checked against that table's schema.
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
  const scoped = await load.tenant(scope.tenantId!);
  const legacy = await load.legacy();
  return [...legacy, ...scoped];
}

/**
 * Single-resource read gate. When read-path enforcement is off this is a
 * pass-through; when on, a tenant-scoped resource must belong to the caller's
 * tenant (legacy rows with no tenantId remain readable during the migration).
 */
export async function enforceTenantOnResource<T extends { tenantId?: Id<"tenants"> | null }>(
  ctx: QueryCtx,
  resource: T | null,
  label: string,
): Promise<T | null> {
  const scope = await readScopedTenant(ctx);
  if (!scope.enforced) return resource;
  if (!resource) return null;
  assertTenantMatch(scope.tenantId, resource.tenantId ?? null, label);
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
  const orgId = identity.organizationId;
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

  // Placeholder: single-bootstrap fallback while the org→tenant mapping is
  // still empty. Returns null when not even the bootstrap tenant exists, so a
  // pre-tenancy request can never leak into a guessed tenant.
  const bootstrap = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", BOOTSTRAP_TENANT_SLUG))
    .first();
  // Never fall back to an arbitrary tenant. An unresolved identity must be
  // denied by the caller rather than silently attached to another ISP.
  return resolvedTenantOrNull(organizationTenantId, bootstrap?._id);
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
