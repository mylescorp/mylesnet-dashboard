# Full Platform Panel Audit — 2026-10-08

## Verification limits

Static audit of dirty checkout `codex/production-feature-bundle` at `e538de4`. There were 93 changed/untracked paths before this report; none were modified. I did not run the app, authenticate per role, inspect live WorkOS/Convex, execute gates, or visually verify themes/mobile/accessibility. GitHub CLI had an invalid token and could not reach GitHub: PR/CI data is Unverified. Runtime behavior not directly established below is marked Unverified. `.aws` was not inspected. This report is an evidence snapshot, not release certification.

## Findings summary

- **Critical — mandatory MFA absent for every platform role.** `convex/lib/mfa.ts` sets `MFA_ENFORCEMENT_MODE="optional"`, `MANDATORY_MFA_ROLES=[]`; `convex/lib/mfa.test.ts` asserts empty mandatory list and optional compliance.
- **Medium — silent-cell allow:** F2 list allows FIN/SUP/RO, and D1 list allows RO. Details in Part 2.
- `apps/admin` and `apps/network` do not exist. Platform pages remain in `apps/web/app/(panels)/platform/`.
- C4 remains on hold and no gateway settings route/function was found. No evidence it shipped in either direction.
- Branch is dirty and not `main`: 93 modified/untracked paths; no stashes. Preserve all pre-existing work.

## Actual role map

`convex/lib/permissions.ts:PLATFORM_SUB_ROLE_MAP`:

| Spec role | Actual accepted slugs |
|---|---|
| SA `platform_super_admin` | `platform_owner`, `platform_admin` |
| OPS `platform_ops` | `ops_manager` |
| FIN `platform_finance` | `finance_manager` |
| SUP `platform_support` | `platform_support` |
| RO `platform_readonly` | `platform_readonly` |

`investor_viewer` is a separate seeded system role and is not in this mapping. `platform_admin` maps to SA for `requirePlatformSubRole`; its seeded permission list excludes role management.

## Part 1 — Module-by-module baseline

RT below means route file exists in current route tree; it does **not** prove rendering. All UI verb coverage, full guard parity, DD, FL, NAV parity, AUD completeness, VAL/schema, per-module TST counts, light/dark ST, CLN, and MRG are **Unverified** unless stated. Route list: `apps/web/app/(panels)/platform/`.

| ID | Status | Actual route(s) | Source-level backend/evidence |
|---|---|---|---|
| A1 | Partial | `/organizations`, `/organizations/new`, `/organizations/[id]` | `tenantControl.ts`: `listForPlatform`, `listForPlatformPage`, `getTenantDetail`, `updateTenant`, `setStatus`, `scheduleDeletion`, `restoreScheduledDeletion`. |
| A2 | Partial | `/organizations/[id]/markets` | `platformMarkets.ts`: list/create/update/lifecycle/archive/restore handlers. |
| A3 | Partial | `/organizations/[id]/suspend`, `/restore` | `tenantControl.ts` status/deletion handlers; silent RO read behavior unverified. |
| B1 | Partial | `/infrastructure/devices`, `/[deviceId]` | `fleet.ts`: `listDeviceFleet`, `getDeviceFleetRow`, `updateDeviceFleetRow`, `registerDevice`, `archiveDevice`, `restoreDevice`; list/detail readers explicitly SA/OPS/SUP/RO, excluding FIN. |
| B2 | Partial | `/infrastructure/provisioning-queue` | `provisioning.ts` list/get/request/decide/deployed/delete handlers. |
| B3 | Partial | `/infrastructure/radius` | `platformRadius.ts`: list/get/create/update/archive/restore. |
| B4 | Partial | `/infrastructure/policy-templates` | `platformPolicyTemplates.ts`: list/get/create/update/version/status/remove/restore. |
| B5 | Unverified | `/infrastructure/health` | Route exists; full rollup source/telemetry contract not re-audited. |
| B6 | Not present | none found | No staged firmware route found. |
| C1 | Partial | `/billing` | `platformRevenue.ts:getDashboard`; actual data reconciliation not verified. |
| C2 | Excluded | — | Standing exclusion. |
| C3 | Partial | `/billing/plans` | `platformPlans.ts`: list/listPublic/create/update/setStatus/remove. |
| C4 | On hold | none found | No payment gateway route/function found. |
| C5 | Not present | none found | No reconciliation surface found. |
| C6 | Not present | none found | No anomaly-to-billing surface found. |
| D1 | Partial | `/agencies`, `/resellers` | `platformPartners.ts`: list/get/tenantOptions/create/update/archive/suspend/restore; silent RO allowed by list. |
| D2 | Partial | `/agencies/[id]/suspend`, `/restore` | `platformPartners.ts:suspend/restore`; live cascade effects not tested. |
| D3 | Not present | none found | No approvals route found. |
| E1 | Partial | `/commissions` | `commissions.ts`, `payouts.ts`; full UI/verb and role parity unverified. |
| E2 | Partial | `/commissions/payouts`, `/[id]` | `payouts.ts` platform list/detail and payout operations. |
| E3 | Not present | none found | No rate configuration route. |
| E4 | Not present | none found | No referral rewards UI/backend verified. |
| F1 | Partial | `/vouchers/monitor` | `voucherFraud.ts:listRedemptionMonitor`, `flagVoucher`. |
| F2 | Partial | `/vouchers/packages` | `platformVoucherPackages.ts:list/create/update/setStatus/remove/restore`; list guard mismatch below. |
| G1 | Unverified | `/access` | User/access UI route; complete team-user CRUD not established. |
| G2 | Partial | `/users/directory` | `platformUserDirectory.ts:list/updateMembership/sendPasswordReset`; full disable/reset semantics unverified. |
| G3 | Unverified | `/access` | `rolesAdmin.ts` role/catalog handlers; route variance informational. |
| G4 | Partial | `/api-keys` | `platformApiKeys.ts:list/listOrganizationsByApiKey/create/revoke/update`; token one-time handling in UI unverified. |
| H1 | Not present | none found | `broadcasts.ts` backend functions exist, but no communications route. Changelog is not a module. |
| H2 | Not present | none found | No SMS campaign route. |
| H3 | Not present | none found | No email campaign route. |
| I1 | Unverified | `/support`, `/support/[id]` | `supportTickets.ts` platform queue/detail/create/update/archive/restore functions; category and role parity not fully audited. |
| I2 | Partial | `/support/sla` | `platformSla.ts:list/create/update/remove`. |
| I3 | Not present | none found | No product feedback intake surface. |
| J1 | Partial | `/analytics` | `platformAnalytics.ts:getDashboard`; reader roles SA/FIN/OPS/RO, SUP excluded. |
| J2 | Not present | none found | No tenant-health route. |
| J3 | Partial | `/analytics/leaderboard` | `platformLeaderboard.ts:getTenantLeaderboard`. |
| J4 | Not present | none found | No platform scheduled reports route. |
| K | Partial | `/feature-flags`, `/[flag]` | `featureFlags.ts:listFeatureFlags/getFeatureFlag/evaluateFeatureFlag/setFeatureFlag/removeFeatureFlag`; OPS infra-only restriction unverified. |
| L1 | Partial | `/security`, `/api-keys` | `/2fa` and `/sessions` platform pages not found; user-specific settings not verified. |
| L2 | Partial | `/audit`, `/audit-log`, `/audit-log/[id]` | `platform.ts:listAuditLog/getAuditLogEntry/listAuditLogPage/getAuditChainHealth`. |
| L3 | Partial | `/security/data-requests` | `platformDataRequests.ts:list/get/create/update/remove/restore`; mutation handlers inspected are SA-only and audited. |
| M1 | Not present | none found | No platform system health route. |
| M2 | Not present | none found | No maintenance-mode route. |
| N | Not present | none found | No impersonation route/module verified. |
| O1 | Partial | `/settings` | No `/mail`, `/sms`, `/storage` subroutes found; OPS infra-adjacent list unknown. |
| O2 | Partial | `/settings/white-label` | `platformWhiteLabel.ts:get/save/reset`, SA-only guards. |

Route/source status counts: **Confirmed 0; Confirmed (route variance) 0; Partial 26; Not present 15; Excluded 1; On hold 1; Unverified 4**. No module is certified functional based on static inspection alone. Absence of route does not rule out an internal function or deployed surface.

## Part 2 — RBAC actual vs expected

Confirmed mismatches (not an exhaustive 47×5×verbs diff):

| Module | Role | Verb | Expected | Actual | Severity | Evidence |
|---|---|---|---|---|---|---|
| F2 | FIN | R | · default deny | `list` uses `requirePlatformUser`, allowing platform roles | Medium | `convex/platformVoucherPackages.ts:list`, first handler statement; `convex/lib/auth.ts:requirePlatformUser` |
| F2 | SUP | R | · default deny | Same broad query guard | Medium | Same |
| F2 | RO | R | · default deny | Same broad query guard | Medium | Same; role map in `convex/lib/permissions.ts` |
| D1 | RO | R | · default deny | `platformPartners.list` explicitly includes all five subroles | Medium | `convex/platformPartners.ts:list`; role map |

All silent cells requiring decision: A3 RO; C4 SUP/RO; C5 SUP/RO; C6 SUP/RO; D1 RO; D3 OPS/FIN/RO; E1 SUP/RO; E2 OPS/SUP/RO; E3 OPS/SUP/RO; E4 SUP/RO; F1 SUP/RO; F2 FIN/SUP/RO; G4 SUP/RO; H1 OPS/FIN/RO; H2 OPS/FIN/RO; H3 OPS/FIN/RO; I1 RO; I2 OPS/FIN/RO; J1 SUP; J2 OPS/FIN/RO; J3 OPS/FIN/SUP; J4 OPS/SUP/RO; L3 OPS/FIN/RO; M2 FIN/SUP/RO; N OPS/FIN/RO; O1 FIN/SUP/RO; O2 OPS/FIN/SUP/RO. Actual behavior for all other silent cells remains Unverified. Broad `requirePlatformUser` uses need explicit comparison with each module’s cells.

## Part 3 — Convex inventory

Platform function files include `tenantControl.ts`, `platformMarkets.ts`, `fleet.ts`, `provisioning.ts`, `platformRadius.ts`, `platformPolicyTemplates.ts`, `platformRevenue.ts`, `platformPlans.ts`, `platformPartners.ts`, `commissions.ts`, `payouts.ts`, `voucherFraud.ts`, `platformVoucherPackages.ts`, `platformUsers.ts`, `platformUserDirectory.ts`, `rolesAdmin.ts`, `platformApiKeys.ts`, `broadcasts.ts`, `supportTickets.ts`, `platformSla.ts`, `platformDataRequests.ts`, `platformAnalytics.ts`, `platformLeaderboard.ts`, `featureFlags.ts`, `platformWhiteLabel.ts`, `platform.ts`.

Inspected inventory examples: `fleet.ts:listDeviceFleet/getDeviceFleetRow` query, first statement `requirePlatformSubRole(readers)`, cross-tenant, pagination; `platformVoucherPackages.ts:list` query, first statement `requirePlatformUser`, cross-tenant/paginated; `platformPartners.ts:list/get` cross-tenant, all five roles; `platformAnalytics.ts:getDashboard` cross-tenant aggregate, date index plus `.collect()` with no row cap; `platformApiKeys.ts:create/revoke/update` mutation, SA guard, audit call; `platformDataRequests.ts:update/remove/restore` SA guard and audit; `platform.ts:listAuditLog/getAuditLogEntry/listAuditLogPage` broad platform guard and cross-tenant reads.

This is not a complete exported-function inventory. Grepping “no guard in first 15 lines” does not prove unguarded: helpers/delegation/internal functions may exist. No function is called unguarded solely on that basis. Exhaustive auth-first-statement, validation, audit, tenancy, and test-coverage inventory is Unverified.

## Part 4 — Navigation

`packages/ui/src/navigation/nav.ts` has generic `buildNavGroups`/`buildRouteIndex` primitives. Platform navigation is a separate hand-maintained instance in `apps/web/shared/navigation/product-nav.ts`, not a fully matrix-derived registry. Items without `roles`/`permission` are visible to every resolved platform principal: Overview, Organizations, Subscriptions, Plans, Policy templates, Voucher packages, Support queue, Support SLAs, User directory, Security, Feature flags. The route group layout only proves panel-level membership (`apps/web/app/(panels)/platform/layout.tsx` → `requirePanelAccess("platform")`), not module-level direct-URL denial.

`productNavGroups` filters empty groups and search index derives from filtered groups. Ad hoc role lists mean exact role menus are not a reliable reflection of the authoritative matrix. Overview cards, quick actions, crumbs, notifications/email links, dead links, loading flash, permission-denied UX, keyboard/focus/current state, collapsed rail, and mobile behavior are Unverified.

## Part 5 — Settings

O1 has only `/platform/settings` in the route tree; mail/SMS/storage absent. O2 has `/settings/white-label`, with SA-only `get/save/reset` in `platformWhiteLabel.ts`. C4 route absent/on hold. L1 has `/security`; platform `/2fa` and `/sessions` absent. G3 uses `/access`; K flags have routes and Convex module; M2 route absent. `SettingsShell` exists at `packages/ui/src/components/settings-shell.tsx`; platform usage/RBAC filtering not established. Field-level FIN rejection of secrets, masking, rotate/copy-once, step-up, audit-on-view, OPS page classification, and personal-vs-platform settings distinction are Unverified.

## Part 6 — Security

- **MFA:** `convex/lib/mfa.ts` says optional and empty mandatory list. `convex/lib/mfa.test.ts` asserts optional behavior for admin/ops/finance/support. All platform roles fail the requested mandatory-2FA policy.
- **Cookie evidence:** `apps/web/shared/auth/cookies.ts` uses `__mylesnet_tenant` and `__mylesnet_csrf`; base attributes HttpOnly, Secure, SameSite=Lax, Path `/`, host-only domain, 30-day maxAge. CSRF cookie is HttpOnly and token is issued for request header. `mylesnetCookieNames()` returns only tenant cookie. WorkOS session cookie details delegated to AuthKit (`WORKOS_COOKIE_NAME ?? "wos-session"` in callback). Requested 30-minute inactivity, 5-minute warning, absolute timeout, session clearing on signout/expiry/role change, and forced reauth on role change were not evidenced.
- Self-change protection exists in `platformUserDirectory.ts` helpers; `assertNotSelfApproval` exists in `convex/lib/auth.ts`. Last-super-admin invariant and all revocation flows unverified.
- Impersonation route/module not found; limits not verifiable.
- Backdoor scan found demo seed/examples in `convex/seed.ts` (`@mylesnet.example`, `seed.demo`); `NEXT_PUBLIC_ENABLE_AGENCY_PANEL` and `NEXT_PUBLIC_ENABLE_PARTNER_PANEL` are panel-availability flags in `product-nav.ts`, with no auth-bypass meaning established. No hardcoded email/user override confirmed in scanned hits. `.aws` excluded. Scan not exhaustive.
- `docs/no-technology-stack-exposure.md` mandates safe user-facing errors. Every platform boundary/page was not checked. Exact live text “No active WorkOS organization claim” is absent in scanned source; root cause and local-only status are Unverified without runtime access.

## Part 7 — Standards sweeps

Not exhaustive counts: demo data exists in `convex/seed.ts`; fallback sender in `convex/lib/notify.ts` is `MylesNet <no-reply@mylesnet.africa>`; callback has default cookie name `wos-session`. `.env.example` coverage not checked. `any`/suppressions/logs/commented code/mock data counts are Unverified. Many inspected mutations call `logAudit`, but global mutation audit coverage and hard-delete sweep are Unverified. `platformAnalytics.getDashboard` collects all rows in the 90-day `dailySnapshots.by_date` range without explicit cap; full unbounded query/N+1/missing tenantId-index sweeps are Unverified.

## Part 8 — UX

Shared primitives and `SettingsShell` exist, but exclusive `packages/ui` use by every page is unverified. No light/dark render performed. Metric decorations, skeleton geometry, real empty CTAs, retry errors, responsive/accessibility checks are Unverified. App stylesheet is under `apps/web/app/globals.css`; extraction from app CSS to `packages/ui` is not complete/confirmed. Navigation migration is incomplete as above.

## Part 9 — Architecture, repo, PRs, decisions, gates

- Apps found: `apps/web`, `apps/mobile`; packages `api-contracts`, `config`, `schemas`, `ui`. No `apps/admin`, `apps/network`, standalone `apps/reseller`. Platform remains inside web route group. Legacy `apps/web/admin`, `agency`, `reseller`, `partner`, dashboard folders remain.
- Separate no-deletion audit for `agency/`, `reseller/`, `partner/`, `admin/`, and business-reporting cluster is not evidenced as complete in checked records; status open/Unverified.
- Current branch `codex/production-feature-bundle`, HEAD `e538de4`; local `main` `8cc1fa0` is ahead 15/behind 18 vs origin/main. Local branches: `codex/production-feature-bundle`, `deploy-production-features`, `codex/release-fix`, `main`, `deploy-convex-production`. No stashes. 93 dirty/untracked paths across routes/components/shared navigation+Convex, Convex backend, docs, dependency files, and unrelated landing/dashboard areas; full path listing is `git status --short`. This is material review/release risk. No edits made to them.
- PRs, CI, personal reviews (A3/L2/C4/N): Unverified; `gh pr list` failed for unavailable GitHub API and invalid auth. Historical PR #17 references do not establish current status.
- `docs/decisions.md` contains C2 exclusion, L2 no-backfill, role map/module authority; A3 retention appears in historical notes. Distinct route-slug and C4-hold entries were not confirmed; complete decision register reconciliation Unverified.
- Gates (typecheck, lint, tokens:check, tests/count, build, pnpm audit critical/high): **Unverified, not run on this snapshot**. Prior register reports are historical, not current. Static inventory counted 35 test/spec files overall, 28 under `convex`, not test cases.

## Part 10 — Remaining work / order

Provisional effort/risk because no live integration or full tests were run:

1. Complete A then B; finish B6, verify B5 telemetry and network effects. B-series feeds health/anomaly. L effort, high availability risk.
2. C: reconcile C1/C3, implement C5/C6; C4 waits for merchant/gateway direction. M/L, high financial/secret risk.
3. D: D3 approvals; finish partner onboarding/delegation. M, medium/high tenant-boundary risk.
4. E: rate/rewards (E3/E4), audit payouts/ledger roles. M, high money risk.
5. F: fix F2 read scope and verify F1. S/M, medium risk.
6. G: verify team/directory, self/last-admin/role-change protections. M, high risk.
7. H: broadcasts/SMS/email; require SA co-sign for all-tenant sends. Changelog remains H1 content tag. L, high messaging risk.
8. I: verify category-scoped queue/SLA and add feedback intake. M, medium risk.
9. J: add tenant-health/scheduled reports; verify analytics. M, medium risk.
10. K–O: flag scope, audit/data request, health/maintenance, impersonation, settings/defaults. G2 prerequisite for N; C4 decision first; O1/O2 before tenant settings integration. M/L, high risk for N/maintenance.

## Part 11 — Decisions

1. Decide every silent cell listed in Part 2; recommended default is deny until granted. Confirm whether RO’s “read-only everywhere” supersedes omissions.
2. Choose C4 direction: view/rotate tenant-owned credentials or MylesCorp merchant-of-record.
3. Approve an explicit per-page/field O1 OPS infra-adjacent allowlist.
4. Choose E4 and I3 route slugs; actual shipped slugs remain canonical.
5. Confirm `platform_readonly` policy and whether `investor_viewer` should receive platform access.
6. Resolve idle/absolute timeout and role-change session invalidation against AuthKit.
7. Confirm A3 retention and record coverage for route-slug policy, C4 hold, role mapping.
8. Decide structural split sequencing and owner for the separate no-deletion audit.

## Recommended next five builds

1. Mandatory MFA for all platform roles.
2. Narrow F2 list authorization and resolve D1 RO access.
3. Exhaustive server-guard diff, prioritizing broad guards and explicit deny/silent cells.
4. Session/role-revocation and safe direct-route/error-boundary verification.
5. Obtain PR/CI access and run gates on a reviewed snapshot before merge.
