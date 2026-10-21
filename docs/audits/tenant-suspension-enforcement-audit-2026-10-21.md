# Tenant suspension enforcement audit

**Date:** 2026-10-21
**Reviewed checkout:** `main` at `eb8b2ac`, working tree clean
**Scope:** Status-only audit of how a suspended tenant is denied at the tenant authorization boundary, and of the boundary between suspension and cancellation. This is the Phase 1 item "audit every tenant function for suspension enforcement" and "keep suspension distinct from cancellation".
**Result:** No runtime behavior was changed by the audit itself. Suspension is enforced at a single membership choke point that all tenant-scoped reads and writes pass through. Every public `query`/`mutation` in the 20 tenant-facing Convex modules is role-guarded, resolver-plus-permission-guarded, or an explicitly reviewed exception. Cancellation is not reachable through the lifecycle action.

## Enforcement path

1. `convex/lib/auth.ts` `getActiveTenantMembership` resolves the tenant from the caller's WorkOS organization claim only (never a client-supplied id) and denies two ways:
   - `!canTenantOperate(tenant.status)` — `canTenantOperate` (`convex/lib/tenantCore.ts`) returns false for `suspended` and `cancelled`, true for `trial`/`active`, and true for an unset status so pre-backfill rows stay usable.
   - `assertTenantRelationshipChainActive(ctx, tenant._id)` — throws when any agency/reseller ancestor link is not `active`, and fails closed above the bounded traversal limit.
2. `requirePermission` resolves tenant permissions through `getActiveTenantMembership`, so a suspended tenant's member cannot satisfy a tenant permission, and cannot satisfy a platform permission (they hold no platform role).
3. `requireTenantPermission` resolves through the same choke point and returns a typed `{ user, tenantId }` only for an operable tenant.
4. `tenantControl.getCurrentWorkspace` returns a typed `setup_required` with reason `tenant_suspended` instead of workspace data; the server-side dashboard layout turns that into Next `forbidden()`.

## Reviewed exceptions

| Handler | Why it has no role guard |
|---|---|
| `convex/tenantControl.ts:getCurrentWorkspace` | Self-service workspace query for the signed-in member. It resolves tenancy itself and returns `setup_required` (`tenant_suspended`) rather than data for a suspended tenant; it is the documented dashboard gate. |
| `convex/workspaceSettings.ts:get` | Read-only, and guarded by `resolveTenantAccess` (which denies a suspended tenant) plus an explicit `tenantRoleHasPermission("dashboard:access")` check; denied callers get a safe empty workspace. |

`resolveTenantAccess` is the resolver-only guard used by self-service reads; the audit accepts it only when the same handler also performs an explicit `tenantRoleHasPermission` check.

## Coverage

- 20 tenant-facing modules are discovered from real tenancy usage (they import `convex/lib/tenant` or call `requireTenantPermission`): `agents`, `analytics`, `auditLogTenant`, `commissions`, `dashboard`, `expenses`, `invoices`, `markets`, `networkOps`, `payments`, `payouts`, `plans`, `scheduledReports`, `subscriberDetail`, `subscribers`, `supportTickets`, `teams`, `tenantControl`, `vouchers`, `workspaceSettings`.
- 142 public `query`/`mutation` handlers live in those modules; the contract test credits guards reached through one or more local helpers (for example `supportTickets.platformTicketAccess` -> `requirePlatformSubRole`) so indirect guards are not misreported.
- Actions are excluded from the guard scan: a Convex action cannot read the database and must call a guarded internal mutation or query, which the internal function performs.

## Suspension vs cancellation

- `tenantControl.setStatus` accepts only `v:union(v.literal("active"), v.literal("suspended"))`; cancellation is not a lifecycle action.
- `decideTenantLifecycleTransition` models the requested status as `"active" | "suspended"` only, so no code path can transition a tenant to `cancelled`.
- `cancelled` is the terminal state reached only after the retention/offboarding flow. That flow and its retention period are not owner-approved, so no cancellation path exists yet. Scheduling deletion goes through `scheduleDeletion` into `pending_deletion`, which is also denied by `canTenantOperate` and reversed by `restoreScheduledDeletion` during the 30-day window.

## Network-plane cascade

The documented device billing/RADIUS degradation cascade stays deferred:

- **Billing (implemented and tested):** `convex/lib/platformRevenueCore.ts` excludes `suspended` tenants from contracted MRR/ARR and reports them separately as `suspendedTenants`; `convex/lib/platformRevenueCore.test.ts` covers "trials and suspended tenants do not count as contracted revenue".
- **Device/RADIUS (Phase 7):** there is no RADIUS service or router control plane in this checkout, so no physical device action or simulated RADIUS effect is performed. The register already records this as deferred; suspension blocks tenant access and revenue recognition now, and the network-plane policy (session rejection, CoA/disconnect) lands with the Phase 7 RADIUS estate.

## Evidence

- `scripts/audit/tenant-suspension-enforcement.test.mjs` (included in the repository `test` job) fixes the contract: the membership choke point, the guard routing, the 142-handler coverage, and the no-cancellation lifecycle shape. It fails when a tenant-facing handler loses its guard.
- `convex/lib/tenantCore.test.ts` covers `canTenantOperate`, `isTenantSuspended`, and `decideTenantAccess`, including the suspended denial.
- `convex/lib/tenantLifecycleCore.test.ts` covers suspension/restoration state, idempotency, and the states that cannot be suspended or restored.

## Verification limits

- Static and unit evidence only. The actual authenticated HTTP 403 for a suspended tenant requires an approved suspended test identity on a verified deployment target, which remains blocked (B-001). This audit does not claim a rendered or live HTTP check.
- The audit does not certify request-level behavior of every handler; it certifies that each tenant-facing public handler routes through a suspension-aware guard.
