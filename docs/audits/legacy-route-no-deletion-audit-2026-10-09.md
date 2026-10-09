# Legacy panel and business-reporting route no-deletion audit

**Date:** 2026-10-09  
**Checkout reviewed:** `/home/myles/Work/mylesnet-production`, branch `codex/platform-production`  
**Scope:** Status-only inventory of `/admin`, `/agency`, `/reseller`, `/partner`, and tenant business-reporting routes before app-boundary migration.  
**Result:** No source route, handler, or data was modified, moved, deleted, or retired by this audit. Preserve these surfaces during the platform app split until explicit route ownership, replacement behavior, inbound references, and data/authorization parity are signed off.

## Verification limits

- The browser connector denied access to the user's `http://localhost:3000` tab because a saved permission preference blocks it. This audit verifies source wiring and Git history only; it does not claim a rendered/live route check.
- It does not certify the complete RBAC behavior or safety of every backend handler. Query/mutation references below identify dependencies that need separate authorization and tenant-isolation verification before extraction.
- `rg` results establish references found in the checked-out source, not the absence of external bookmarks, emails, API consumers, or references in unsearched deployment configuration.
- The previous Round 2 audit labels its proposed integration sequence “not executed” (see `docs/audits/platform-panel-audit-round2-2026-10-08.md`, Part A, lines 136–140). The prior 2026-10-08 status-only note in the production plan is not a substitute for this inventory.

## Current app boundary

- `apps/admin` exists as a separate Next.js workspace and has 49 `page.tsx` route entrypoints. Its README and route wrappers establish a platform release root, but route implementations are still imported from `apps/web`; it is not yet an independently extracted platform application.
- `apps/network` does not exist in this checkout. The current `/admin` path is the tenant-administration handoff described below, while the role policy also defines a `network` panel/host for a future control surface.
- No legacy surface in this audit was found under `apps/admin`; these `/admin`, `/agency`, `/reseller`, `/partner`, and tenant reporting paths remain under `apps/web/app/(panels)/`.

## Legacy panel entrypoints

| Shipped path | Route entry and implementation | Verified behavior | References / tests |
|---|---|---|---|
| `/admin` | `apps/web/app/(panels)/admin/page.tsx` reexports `apps/web/admin/AdminEntryPage.tsx` | Calls `requirePanelAccess("admin")`; describes tenant administration and links to `/dashboard/tenant`. This is not the planned `apps/network` super-admin app. | `apps/web/shared/navigation/product-nav.ts` registers the admin panel; `apps/web/shared/components/AccountDrawer.tsx` links to `/admin`; `apps/web/shared/auth/panelAccess.ts` lists tenant-admin role slugs. `apps/web/shared/auth/panelAccess.test.ts`: “panel access maps current WorkOS system and organization role slugs”, “panel access denies roles outside the requested panel”, and “platform staff are returned to their control plane instead of a tenant workspace”. |
| `/agency` | `apps/web/app/(panels)/agency/page.tsx` reexports `apps/web/agency/AgencyEntryPage.tsx` | Calls `requirePanelAccess("agency")`, then renders only “Agency access is confirmed.” No agency workspace workflow is present in this page. | `product-nav.ts` registers an agency root; `panelAccess.ts` maps `agency` and `org-agency`. Panel-role tests above cover generic panel access, not agency workflow behavior. |
| `/reseller` | `apps/web/app/(panels)/reseller/page.tsx` reexports `apps/web/reseller/ResellerEntryPage.tsx` | Calls `requirePanelAccess("reseller")`, then renders only “Reseller access is confirmed.” No reseller workspace workflow is present in this page. | `product-nav.ts` registers a reseller root; `panelAccess.ts` maps `reseller` and `org-reseller`. Panel-role tests above cover generic panel access, not reseller workflow behavior. |
| `/partner` | `apps/web/app/(panels)/partner/page.tsx` reexports `apps/web/partner/PartnerEntryPage.tsx` | Calls `requirePanelAccess("partner")`, then renders only “Partner access is confirmed.” No partner workspace workflow is present in this page. | `product-nav.ts` registers a partner root; `panelAccess.ts` maps `partner` and `org-partner`. Panel-role tests above cover generic panel access, not partner workflow behavior. |

`PANEL_ROLE_REQUIREMENTS` also declares a `network` role group, including network owner/admin/operator and selected platform owner/admin aliases, in `apps/web/shared/auth/panelAccess.ts`; this is evidence of policy wiring only, not proof that a network app or route exists.

## Business-reporting and finance routes

These paths are tenant-side routes in the `(panels)` route group. Their route files reexport implementations from `apps/web/dashboard/routes/`. They are distinct from platform analytics and from J4's platform scheduled reports.

| Shipped path | Implementation / component | Backend dependencies evidenced in source | Status and reference notes |
|---|---|---|---|
| `/analytics` | `apps/web/app/(panels)/analytics/page.tsx`, `AnalyticsRedirectPage` | Redirects to `/insights/analytics`; no data query in the alias. | Compatibility redirect remains shipped. |
| `/insights/analytics` | `apps/web/dashboard/routes/insights/analytics/page.tsx`, `AnalyticsPage` | `markets.listMarkets`; `analytics.getRevenueTrend`, `getSubscriberTrend`, `getTopAgents`, `getSalesMix`. | Tenant analytics implementation. `/insights/analytics` is in `apps/web/shared/navigation/product-nav.ts` and `content-nav.ts`. |
| `/sales` | `apps/web/dashboard/routes/sales/page.tsx`, `SalesPage` | `analytics.getSalesMix`, `analytics.getTopAgents`. | Tenant sales implementation. No non-route inbound link was found in the source search used for this audit. |
| `/revenue` | `apps/web/dashboard/routes/revenue/page.tsx`, `RevenuePage` | `markets.listMarkets`, `analytics.getRevenueTrend`. | Labeled “Payments” in the tenant billing group of `product-nav.ts` and `content-nav.ts`. |
| `/profit-loss` | `apps/web/dashboard/routes/profit-loss/page.tsx`, `ProfitLossPage` | `markets.listMarkets`, `expenses.listAllFinancials`, `costAllocation.getCostAllocation`. | Tenant financial reporting. No non-route inbound link was found in the source search used for this audit. |
| `/profitability` | `apps/web/dashboard/routes/profitability/page.tsx`, `ProfitabilityPage` | `markets.listMarkets`, `expenses.listAllFinancials`. | Tenant financial reporting. No non-route inbound link was found in the source search used for this audit. |
| `/investor-reports` | `apps/web/dashboard/routes/investor-reports/page.tsx`, `InvestorReportsPage` | `markets.listMarkets`; `investors.getInvestorOverview`, `listInvestors`, `listInvestorReports`; mutations `createInvestor`, `updateInvestor`, `generateInvestorReportForAdmin`. UI checks `investors:manage` before management controls. | Tenant investor reports. Separate from platform scheduled reports. No non-route inbound link was found in the source search used for this audit. |
| `/scheduled-reports` | `apps/web/dashboard/routes/scheduled-reports/page.tsx`, `ScheduledReportsPage` | `scheduledReports.listScheduledReports`, `listReportExports`; mutations `createScheduledReport`, `updateScheduledReport`, `deleteScheduledReport`. | Tenant scheduled reporting/export workflow; this is not platform J4. No non-route inbound link was found in the source search used for this audit. |
| `/commissions` | `apps/web/dashboard/routes/commissions/page.tsx`, `CommissionsPage` | Commission query plus `agents.listAgents`, `markets.listMarkets`; mutations request/approve/process/mark-paid/dispute commission payouts. | Tenant commission and payout workflow, not platform E1/E2. `/commissions` is also a platform path prefix, so app/panel ownership must be preserved explicitly in migration. |
| `/finance/invoices` | `apps/web/dashboard/routes/finance/invoices/page.tsx`, `InvoicesPage` | `invoices.list`, `getStats`, `subscribers.list`; mutations `create`, `issue`, `markPaid`, `cancel`. UI checks the corresponding invoice permissions. | Tenant customer billing. Not C2 tenant SaaS invoices. |
| `/finance/payments` | `apps/web/dashboard/routes/finance/payments/page.tsx`, `PaymentsPage` | `payments.list`, `getStats`, `subscribers.list`; mutations `create`, `refund`. UI checks `payments:create` and `payments:refund`. | Tenant customer payments. `/revenue` is the current nav entry; preserve this route and its direct URL behavior during migration. |

The source search found external-to-route references in the tenant navigation for `/revenue` and `/insights/analytics`, plus the explicit `/analytics` redirect. It found the four legacy panel roots in `product-nav.ts`, `/admin` in `AccountDrawer.tsx`, and route-local references for detail/action navigation. It did not find other non-route source links to `/sales`, `/profit-loss`, `/profitability`, `/investor-reports`, `/scheduled-reports`, or the two `/finance/*` pages; this is not proof that no external consumer exists.

## Handler and test boundary

The UI references live modules under `convex/`, including `analytics.ts`, `commissions.ts`, `costAllocation.ts`, `expenses.ts`, `investors.ts`, `scheduledReports.ts`, `invoices.ts`, and `payments.ts`. The tenant finance modules write audit entries for several mutations (for example `convex/invoices.ts` and `convex/payments.ts`), but a complete guard, schema, audit, isolation, or deletion review of these modules was not part of this no-deletion check. No route-specific test file for these legacy entrypoints/report pages was found by the test-file search. `apps/web/shared/auth/panelAccess.test.ts` covers panel slug mapping and generic denial/fallback only; it does not prove each page or handler works end to end.

Historical path review found these route/ownership reorganizations in Git history: `e82b038` (“refactor: consolidate MylesNet into direct web ownership modules (#25)”), `fd6d6a6` (“refactor(web): relocate panels/shared/auth/landing into ownership folders”), `d06fbe1` (“refactor: organize web panels by feature boundary”), and `6afec6d` (“WIP(web): billing/invoice surfaces, thin route facades, restructure follow-ups”). This confirms prior code organization changes, not approval to retire any current route.

## No-deletion disposition and migration gate

1. Retain the four legacy panel routes and all listed business-reporting routes in `apps/web` while building/extracting the target applications.
2. Keep tenant `/admin` administration distinct from the planned `apps/network` `/admin` network/super-admin surface; route/domain ownership and hostname migration require an explicit mapping before either path changes.
3. Keep tenant `/scheduled-reports` and tenant `/commissions` distinct from platform J4 and platform commission routes, even where labels or route prefixes overlap.
4. Before any retirement, record an owner-approved destination for every path, inventory inbound links beyond this source tree (email, notifications, bookmarks/API consumers), verify redirects and page/data/permission parity, and run authenticated route and backend tests for every mapped role.
5. This audit authorizes no deletion, redirect, move, or rewrite. A separate implementation decision and review are required after replacement behavior is proven.

## Post-audit app extraction checkpoint (2026-10-09)

After the no-deletion inventory was recorded, the isolated worktree copied the 48 existing platform route page sources and the platform UI source tree into `apps/admin`; it also copied the root layout, global stylesheet, theme initializer, and brand asset. The original web route files remain present. An automated source-contract test asserts page-path parity, local root assets, and that admin route files do not re-export web route modules. The pure panel role map and fallback policy now live in `@mylesnet/panel-access`, consumed by both apps through the same server panel gate. Admin lint, typecheck, and webpack production build passed; the build manifest contains every platform route. The repository suite passes 233/233 tests. This extracts page/UI/root-shell source and pure policy ownership but does not complete app separation: the admin proxy still imports from `apps/web`, and session/auth runtime, navigation, Convex/UI adapters remain path-aliased to `apps/web`. Browser verification remains blocked by the saved permission preference.
