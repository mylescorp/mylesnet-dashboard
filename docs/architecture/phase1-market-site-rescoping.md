# Phase 1 — Market/site re-scoping (X-TEN §B16)

**Date:** 2026-09-11
**Status:** Design (no behavior change)
**Contract in code:** `convex/lib/tenantMigration.ts` → `MARKET_SITE_RESCOPING`

## 1. Problem

The Phase 1 tenancy model introduces `tenants` + `tenantScope` (optional
`tenantId`) across 60 tenant-owned tables. `markets` is one of them. The
absence of an explicit owner-scope decision for markets leaves a seam ambiguity:
does a `market` sit *inside* a tenant, or is it an unrelated column?

This document fixes that decision and maps the existing `marketId` surface so
the read-path slice (Step 3) and future phases target the right seam.

## 2. Decision

**In Phase 1, a market IS one tenant's site.**

- `markets.tenantId` keys the owning tenant (bootstrap tenant `mylesnet` for all
  current records).
- `marketId` remains the **tenant-internal site seam**. Every table that already
  references `markets._id` continues to do so unchanged.
- `userMarketMemberships` doubles as the tenant-site membership edge (owner →
  tenant → market → role), giving `resolveTenantFromAuth` and
  `requireMarketAccess` a single coherent ownership chain.
- The dedicated `sites` entity from the Master spec §18.8 (N-tenants,
  N-sites, site URLs, site-scoped identity) is **NOT promoted now**. It stays
  the Phase 8 "promote-sites" step behind the same flag
  (`tenant.readPath` → later `sites` rollout).

Consequence: the per-market permission gates already in the codebase
(`requireMarketAccess`) become the tenant-internal authorization layer. Newly
added `requireTenantMember` / `withTenantScope` guards become the tenant
boundary. No existing query path is broken because `tenantId` on legacy rows is
undefined and the read rule is *legacy pass-through* on the bootstrap tenant.

## 3. Surface map (grep-verified 2026-09-11)

- **137** tables carry `tenantScope` (60 tenant-owned, see §B2 inventory).
- **19** schema tables declare `marketId` (site seam):
  `userMarketMemberships`, `marketOperatingCosts`, `devices`,
  `agentMarketAssignments`, `commissions`, `vouchers`, `voucherBatches`,
  `alerts`, `renewalCredits`, `leaderboardSnapshots`, `marketFinancials`,
  `subscriberSnapshots`, `agentActivity`, `expenses`, `dailySnapshots`,
  `plans`, `maintenanceWindows`, `telemetryHourly`, `telemetryDaily`.
- **348** `marketId` references across **38** convex files (handlers, routes,
  schema, http ingest). The app route layer has **zero** `marketId`
  references — the seam is server-scoped, which keeps the re-scoping internal.
- **6** files already gate reads per-market via `requireMarketAccess`:
  `accessPoints`, `dashboard`, `networkSwitches`, `plans`, `supportTickets`,
  `vouchers`.

## 4. Phased adoption

| Step | Content | Flag | When |
| --- | --- | --- | --- |
| 1 | Schema: `markets.tenantId`, `by_tenant` index | none | Done (2026-09-11) |
| 2 | Read-path: `withTenantScope` wraps the market-scoped queries | `tenant.readPath` | This week's slice |
| 3 | Write-path: new market rows get `tenantId` | `tenant.writePath` | Phase 1 |
| 4 | Backfill legacy `tenantId` (undefined → bootstrap tenant) | `tenant.backfill` | After prod deploy confirmation |
| 5 | Enforcement: `tenantId` required | `tenant.enforceRequired` | Phase 1 end |
| 8 | Promote `sites` as a first-class entity (spec §18.8) | `sites` | Phase 8 |

## 5. Which queries change and how

`marketId`-scoped queries today scan with `by_market_*` indexes and are
pre-filtered by `requireMarketAccess`. The Phase-1 read slice adds one
additional dimension without removing anything:

1. `requireTenantMember(ctx)` resolves the caller's tenant from a WorkOS org
   claim or the explicit bootstrap `mylesnet` tenant. If neither resolves, it
   denies access; it never selects an arbitrary tenant.
2. `withTenantScope` narrows list queries to `by_tenant` (or keeps `by_market`
   for the already market-scoped paths).
3. Legacy rows (`tenantId: undefined`) pass through unchanged on the bootstrap
   tenant (additive read rule) — no data is hidden pre-backfill.
4. `requireMarketAccess` continues to enforce the tenant-internal site role.

## 6. Out of scope (now)

- `sites` entity, site-URL based tenancy, site-scoped identity (Phase 8).
- Investor/prospect surfaces stay platform-owned (`marketProspects`,
  `investors`, `investorReports`).
- `http.ts` collector/webhook ingest is tenantless by design (authenticated by
  client secret), and is exempt from tenant guards.

## 7. Owner sign-off touchpoints

The two pending review-queue items intersect this doc only at backfill time:
`centipidCredentials` (global provider credential used by every tenant's
collection) and `agents`/`teams` (single-tenant ownership). Neither changes the
market/site seam above; both gate the backfill run `tenantid-backfill-001`,
not this design.

## 8. Mirror

This file is mirrored at
`C:\Obsidian\MylesCorp-Brain\products\mylesnet\Reports\market-site-rescoping-2026-09-11.md`
(byte-identical per the vault-sync rule).
