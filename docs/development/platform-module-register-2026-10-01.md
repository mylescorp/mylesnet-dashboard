---
type: report
status: active
date: 2026-10-01
author: Jonathan Myles
tags:
  - mylesnet
  - platform
  - module-reconciliation
---

# MylesNet Platform Canonical Module Register

## Authority and count

This register records the owner-provided A1–O2 platform list and role matrix as authoritative over older repo/vault recon. The list has 45 IDs, not 36. C2 is retained for tracking but excluded from implementation, leaving 44 in-scope modules. The supplied file-grounded audit snapshot names branch `myles/platform-audit-hash-chain`; it is historical and must not be represented as a fresh audit of current `main`.

Role abbreviations: SA = `platform_super_admin`; OPS = `platform_ops`; FIN = `platform_finance`; SUP = `platform_support`; RO = `platform_readonly`. `CRUD`, `CRU`, `RU`, `R`, and `—` retain the owner-provided meanings. Exception: scoped support impersonation is limited to end-tenant client roles, maximum one hour, reason required, and audited. All-tenant broadcast requires super-admin co-sign.

## Canonical module inventory

The status column records the supplied audit snapshot. Revalidate route, backend gate, UI, and tests on current `main` before treating any row as confirmed.

| ID | Module and canonical route | Canonical access | Supplied snapshot |
|---|---|---|---|
| A1 | Tenants `/platform/organizations`, `/[id]` | SA CRUD; OPS CRU; FIN/SUP/RO R | Partial; canonical aliases now exist, matrix/UI/tests still incomplete |
| A2 | Markets `/platform/organizations/[id]/markets` | SA/OPS CRUD; FIN/SUP/RO R | Partial; list/create/edit/lifecycle/archive/restore implemented, helper invariants covered, direct role/cross-tenant integration tests pending |
| A3 | Suspension/restoration `/platform/organizations/[id]/suspend`, `/restore` | SA CRUD; OPS CRU; FIN/SUP/RO R | Partial; canonical confirmation routes, audited lifecycle transitions, prior-state restoration; org-claim tenant resolution now denies unmapped/malformed scopes, and a server-side dashboard gate now calls the authenticated workspace query and invokes Next `forbidden()` for suspended tenants; authenticated HTTP 403 behavior, full API coverage, and RADIUS/billing/device cascade are not yet proven |
| B1 | Device fleet `/platform/infrastructure/devices`, `/[id]` | SA/OPS CRUD; SUP/RO R; FIN — | Partial; route, registry, UI, exact role gates and cursor pagination added; telemetry ingestion is absent |
| B2 | Provisioning `/platform/infrastructure/provisioning-queue` | SA CRUD; OPS CRU; others R | Partial; canonical route and review UI added, latest 200 rows only; no device-side provisioning integration |
| B3 | RADIUS fleet `/platform/infrastructure/radius` | SA/OPS CRUD; others R | Not present |
| B4 | Policy templates `/platform/infrastructure/policy-templates` | SA/OPS CRUD; others R | Not present |
| B5 | Health rollup `/platform/infrastructure/health` | SA/OPS RU; SUP/RO R; FIN — | Not present |
| B6 | Firmware/config `/platform/infrastructure/firmware` | SA CRUD; OPS CRU; others R | Not present |
| C1 | Platform revenue `/platform/billing` | SA/FIN/RO R; OPS/SUP — | Partial; contracted MRR/ARR page, KES rollup, role-gated query, daily snapshots and pricing tests added; deployment and historical evidence pending |
| C2 | Tenant invoices | Excluded from build | Excluded |
| C3 | Plans `/platform/billing/plans` | SA/FIN CRUD; others R | Partial pending production deployment/access evidence; local create/read/update/archive/reactivate/delete now complete, with referenced-plan deletion guard and role-aware UI |
| C4 | Payment gateway `/platform/settings/payments` | SA CRUD; FIN U non-secret only; OPS — | Not present |
| C5 | Reconciliation `/platform/billing/reconciliation` | SA/FIN CRUD; OPS R | Not present |
| C6 | Session/billing anomalies `/platform/billing/anomalies` | SA RU; FIN R; OPS RU | Not present |
| D1 | Agencies/resellers `/platform/agencies`, `/platform/resellers` | SA CRUD; OPS/FIN/SUP R | Not present |
| D2 | Agency suspension `/platform/agencies/[id]/suspend` | SA CRUD; others R | Not present |
| D3 | Provisioning approvals `/platform/onboarding/approvals` | SA CRU; SUP R | Partial |
| E1 | Commission ledger `/platform/commissions` | SA/FIN CRUD; OPS R | Partial |
| E2 | Payouts `/platform/commissions/payouts`, `/[id]` | SA/FIN CRUD; OPS — | Partial |
| E3 | Commission rates `/platform/commissions/rates` | SA/FIN CRUD | Not present |
| F1 | Voucher monitor `/platform/vouchers/monitor` | SA/OPS RU; FIN R | Confirmed in snapshot |
| F2 | Voucher packages `/platform/vouchers/packages` | SA/OPS CRUD | Partial |
| G1 | Platform users and roles `/platform/access` | SA CRUD; others R, no self-elevation | Partial; full management and read-only summary unified on `/platform/access`; `/access` redirects there |
| G2 | User directory `/platform/users/directory` | SA RU; SUP RU limited disable/reset; others R | Not present |
| G3 | Roles `/platform/roles` | SA CRUD; others R | Partial |
| G4 | Platform API keys `/platform/api-keys` | SA CRUD; OPS R; FIN — | Not present |
| H1 | Broadcast `/platform/communications` | SA CRUD; SUP CR with co-sign for all tenants | Partial |
| H2 | SMS `/platform/communications/sms` | SA CRUD; SUP CR | Partial |
| H3 | Email `/platform/communications/email` | SA CRUD; SUP CR | Not present |
| I1 | Global tickets `/platform/support`, `/[id]` | SA/SUP CRUD; OPS RU network; FIN RU billing | Partial |
| I2 | SLA `/platform/support/sla` | SA CRUD; SUP R | Not present |
| J1 | Analytics `/platform/analytics` | SA/FIN/OPS/RO R | Partial |
| J2 | Tenant health `/platform/analytics/tenant-health` | SA/SUP R | Not present |
| J3 | Leaderboard `/platform/analytics/leaderboard` | SA/RO R | Partial |
| J4 | Scheduled reports `/platform/analytics/scheduled-reports` | SA CRUD; FIN CRUD billing reports | Partial |
| K | Feature flags `/platform/feature-flags`, `/[flag]` | SA CRUD; OPS U infra flags; others R | Confirmed in snapshot |
| L1 | Security `/platform/security`, `/2fa`, `/sessions`, `/api-keys` | SA CRUD; others R | Partial |
| L2 | Audit `/platform/audit-log`, `/[id]` | all roles R, scoped; append-only hash chain | Partial, canonical list/detail routes now exist; role/access coverage pending |
| L3 | Data requests `/platform/security/data-requests` | SA CRUD; SUP CR intake only | Not present |
| M1 | Health `/platform/health`, `/convex`, `/vercel`, `/workos`, `/uptime` | all roles R | Not present |
| M2 | Maintenance `/platform/maintenance` | SA CRUD; OPS CU | Not present |
| N | Impersonation `/platform/impersonation` | SA/SUP CR, scoped; 1h maximum, audited | Not present |
| O1 | Configuration `/platform/settings`, `/mail`, `/sms`, `/storage` | SA CRUD; OPS U infra-adjacent | Not present |
| O2 | White-label `/platform/settings/white-label` | SA CRUD | Not present |

## Current-branch filesystem recheck

The current route scan under `apps/web/app/(panels)/platform` found pages for overview, access, audit, billing (C1), feature flags, organizations (aliases), tenant markets, tenant detail/list, tenant suspend/restore, security, subscriptions, and voucher monitoring. The C2 invoice slice remains absent. `/platform/access` is the one access-management surface; `/access` is a compatibility redirect. This route scan does not prove backend guard, UI completeness, or test status; the supplied route/gate/UI/test rows remain the baseline for other modules, downgraded where their own notes contradict the canonical matrix.

Updated rollup: **2 Confirmed** (F1, K), **21 Partial**, **21 Not present**, **1 Excluded** (C2). A1/A2/A3/C1, B1/B2 now have current implementation work, but B1 telemetry and B2 device execution plus authenticated role coverage remain incomplete. Total remains 45.

## Current-session changes and verification

- A2 implementation is present in `convex/platformMarkets.ts`, the typed web reference, `PlatformMarkets`, and `/platform/organizations/[id]/markets`. Read/create/edit/lifecycle/archive/restore actions are sub-role gated and audited; archive refuses markets with active assignments. Six focused tests now cover input shape, cross-tenant mismatch denial helper, active-assignment archive safety, canonical role expansion, and allow/deny decisions for the market role matrix. These exercise shared pure authorization logic, not the Convex mutation handlers. It remains **Partial** until mutation-level authorization and authenticated cross-tenant integration coverage pass.
- App TypeScript check passed; focused frontend ESLint passed; direct Convex TypeScript check passed; full repo Node test suite passed (161/161), including A2/C1 role-matrix tests and tenant-org fallback regressions; production Next build passed and listed 98 routes.
- Build verification first exposed an existing `UnifiedShell` `useSearchParams()` Suspense issue that prevented static generation. The shell is now wrapped in Suspense with the standard app bootstrap loader; the subsequent production build passes.
- Local runtime: `/` returned HTTP 200; `/platform/billing` returned 307 while unauthenticated. Authenticated A2 route/data behavior was inspected in Chrome at `/platform/organizations/[id]/markets` using an existing platform session; no tenant changes were made. The A3 suspended branch could not be exercised without a suspended test identity.
- The root `pnpm` shim could not start because mise has no configured pnpm version. Checks ran through installed local binaries instead.
- C2 work introduced during the earlier session was removed after reconciling the explicit exclusion. No tenant SaaS invoice schema, endpoint, or UI remains from that slice.
- A3 lifecycle state preserves whether the tenant was trial or active before suspension; canonical confirmation routes and four lifecycle tests are present. This session fixed a tenant resolver edge case: an identity with a malformed or unmapped `org_id` no longer falls back to the bootstrap tenant. A server-side dashboard layout now checks the authenticated `getCurrentWorkspace` result before rendering children and calls Next `forbidden()` when suspended; `authInterrupts` is enabled and a dashboard-specific 403 boundary is present. Build/typecheck pass, but the authenticated suspended branch and actual HTTP status remain unverified. Complete suspended-tenant API coverage and device billing/RADIUS cascade remain open.
- Follow-up A3 API audit: `requirePermission` is used by the majority of operator APIs but previously checked only account/role permission, so direct Convex calls could bypass tenant suspension. It now checks tenant lifecycle for non-platform roles; explicit unresolved WorkOS `org_id` is denied, platform roles remain available for cross-tenant operations, and legacy no-org identities retain pre-bootstrap behavior. This is a broad shared gate with web TypeScript check passing; direct endpoints using other auth helpers or no tenant lifecycle guard still need file-by-file review and authenticated runtime coverage. This is not yet a complete API enforcement claim.
- L2 route follow-up: added canonical `/platform/audit-log` and `/platform/audit-log/[id]`, a platform-gated single-entry query, linked entries from the paginated log, before/after detail rendering, and sealed hash-chain sequence/link/hash fields. TypeScript check and `git diff --check` pass. L2 remains Partial until direct role/access coverage is exercised.
- C3 implementation: added a global KES monthly plan catalogue with baseline Starter/Growth/Pro prices, super-admin/finance writes, read access for other platform roles, audited create/update/archive/delete, and a deletion guard for plans with active entitlements. C1 now reads the catalogue (including archived plans for existing entitlements), and the public pricing cards read only active catalogue entries. Added plan-code index for safe active-entitlement deletion checks. Web/Convex TypeScript checks and optimized Next production build pass; local `/pricing` is 200 and unauthenticated `/platform/billing/plans` redirects (307). Schema/function deployment and authenticated role/access coverage remain pending.
- B1/B2 implementation: restored and adapted the device registry and provisioning queue to the current panel layout. B1 adds cross-tenant list/detail, register/update/archive/restore with audit entries, finance denial, and an ops-only management workflow; B1 list reads are cursor-paged in batches of 50 with server cap 100 and indexed status filtering. B2 adds pending request, approve/reject with reason, operator-verified deployment recording, scoped role checks, and terminal request deletion by super-admin; linked B1 device status now follows request, rejection, and verified deployment transitions with audit entries. The deployment record is operator attestation, not device telemetry. B2 is bounded to latest 200 records and does not push configuration to devices. Both remain Partial; authenticated role/integration tests and verified-backend deployment are outstanding.
- Schema compatibility: the platform fleet uses the tenant/market-scoped `platformDevices` table; retired legacy `devices` remains absent per migration inventory and retirement tests.
- 2026-10-05 verification: test suite 167/167 passed; Convex and web TypeScript checks and `git diff --check` passed. Local web on port 3000 returns 200 at `/`; unauthenticated `/platform/access` redirects (307).
- Production Convex deployment was attempted per `docs/production-deployment.md`, but this checkout has no approved `.env.deploy` or production deployment credentials/target. The CLI exited with `.env.deploy: not found` before deploying anything. Production functions/schema remain undeployed; deployment awaits the approved target and the full release gate.
- 2026-10-05 CRUD follow-up: added audited `tenantControl.updateTenant` for A1 name/country/timezone/currency edits, gated to super-admin and ops, and exposed it from the organization detail page. Tenant slug and lifecycle remain immutable through this profile editor. Convex and web TypeScript checks passed.
- C3 plans + tenant subscriptions: catalogue deletes now refuse any plan referenced by a subscription; one-time baseline seeding no longer recreates a deliberately deleted plan. Tenant subscription management now selects from the catalogue, validates plan and date fields server-side, supports audited create/update and a reason-required audited remove restricted to super-admin, while ops can create/update and the other roles remain read-only. Existing invoices and payment data are untouched. Focused web ESLint, web TypeScript, Convex TypeScript, and `git diff --check` passed; authenticated role integration and production deployment remain unverified.
- Full CRUD gap review: the 44 in-scope modules do not all have platform CRUD. The existing register's 2 Confirmed / 21 Partial / 21 Not-present snapshot is not a CRUD-complete status. Current canonical platform routes exist for A1-A3, A2 markets, B1-B2, C1/C3, G1/G3, K, L1-L2 and F1; many have only a subset of the role-authorized operations. B3-B6, C4-C6, D1-D3, E3, F2, G2/G4, H1-H3, I1-I2, J1-J4, L3, M1-M2, N and O1-O2 still need dedicated platform surfaces and/or backend operations. Existing operator `/commissions`, `/tickets`, `/analytics`, `/scheduled-reports`, and `/vouchers` are not treated as canonical platform CRUD surfaces.
- CRUD interpretation follows the authority matrix: C1/J1/J2/J3/L2/M1 are read-only, L2 is append-only at the data layer, B5/C6 are RU, B6/D3 are CRU, C4 is secret rotate-only with finance limited to non-secret fields, and C2 remains excluded. Those modules must not receive unauthorized update/delete controls merely to satisfy a literal CRUD label.
- Access route consolidation: `/platform/access` now renders the full access manager for authorized administrators and the read-only role/staff view for platform users with `users:read`; `/access` redirects to it. Sidebar, account drawer, and overview link to `/platform/access`. Local app typecheck/build pass; both unauthenticated URLs redirect through WorkOS, so authenticated route behavior still needs runtime coverage.
- Sidebar follow-up: platform nav role visibility now recognizes both canonical sub-role slugs and the app's mapped legacy slugs (`platform_owner`, `platform_admin`, `ops_manager`, `finance_manager`, `platform_support`). The read-only G1 staff panel filters to users with platform roles so it does not expose tenant users as platform staff. Web typecheck and `git diff --check` pass; authenticated sidebar visibility still requires role-based browser coverage.
- The platform tenant nav, overview actions, and tenant list/detail links now use canonical `/platform/organizations` paths; `/platform/tenants` remains a compatibility route.
- C1 follows the repo-approved KES 500/1,400/3,500 monthly plan contract. Its values are explicitly contracted list-price estimates, not issued invoices or collected cash. It excludes suspended/trial/unknown plan IDs and stores aggregate daily snapshots.
- This is not a production readiness claim. Auth policy conflict, deployment boundary, complete cross-tenant tests, and current-main reconciliation remain open.

## Next work

1. Complete A2 direct role-denial and authenticated tenant-isolation integration coverage.
2. Exercise the A3 gate with an approved suspended test identity and verify the actual HTTP 403; audit all tenant functions and implement/prove the documented device billing/RADIUS cascade. Resolver tests prove an unmapped explicit org claim cannot fall back to bootstrap.
3. Verify daily C1 snapshots against a deployed non-production backend and verify the Convex read guard for SA/FIN/RO versus OPS/SUP in an authenticated integration test; a pure role-matrix policy test now covers the expected C1 mapping.
4. Add telemetry ingestion to B1; add device-side provisioning execution for B2 only after the worker/device contract is established.
5. Re-audit each remaining module ID on the checked-out branch with route, gate, UI, and test evidence.
6. Keep all pre-existing local edits intact; reconcile the upstream-behind checkout before release.
