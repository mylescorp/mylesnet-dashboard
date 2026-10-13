# Legacy panel and business-reporting route no-deletion audit (current main)

**Date:** 2026-10-13
**Reviewed checkout:** `main` at `4dbf09f`, working tree clean
**Scope:** Status-only inventory of the shipped legacy `/admin`, `/agency`, `/reseller`, and `/partner` panel roots and the tenant business-reporting and finance routes, before any platform app-boundary extraction.
**Result:** No source route, handler, or data was modified, moved, deleted, or retired by this audit. Preserve these surfaces while the target applications are built and split.

## Relationship to the earlier audit

An earlier status-only inventory (`docs/audits/legacy-route-no-deletion-audit-2026-10-09.md`) was recorded on an isolated production worktree (`codex/platform-production`, later `production-feature-bundle`) whose tree also held a partial `apps/admin` extraction and the pure `@mylesnet/panel-access` package. That tree is not on `main`; `apps/` on `main` contains only `web` and `mobile`. This audit re-baselines the same surfaces against the current `main` tree so the no-deletion disposition is grounded in the shipping code rather than an unmerged worktree.

## Verification limits

- Source wiring and Git history only. This audit does not claim a rendered or live HTTP check, and it does not certify complete RBAC behavior or tenant isolation of every backend handler.
- Reference searches establish what the checked-out source contains, not the absence of external bookmarks, emails, notifications, or API consumers.
- The previous audit's "post-audit app extraction checkpoint" describes an `apps/admin` tree that does not exist on `main`; it is background only and is not evidence of the current boundary.

## Current app boundary

- `apps/` contains `web` and `mobile` only; `apps/admin` and `apps/network` are absent on `main`.
- The platform control plane ships inside `apps/web`: source under `apps/web/platform/`, routes under `apps/web/app/(panels)/platform/` (23 `page.tsx` entrypoints plus the nested `layout.tsx`).
- `/admin` is the tenant-administration handoff described below. It is not the planned `apps/network` super-admin surface.
- No legacy surface in this audit lives outside `apps/web/app/(panels)/`.

## Legacy panel entrypoints

| Shipped path | Route entry and implementation | Verified behavior | References and tests |
|---|---|---|---|
| `/admin` | `apps/web/app/(panels)/admin/page.tsx` re-exports `apps/web/admin/AdminEntryPage.tsx` | Calls `requirePanelAccess("admin")`; describes tenant administration and links to the tenant workspace. Not the planned `apps/network` super-admin app. | `apps/web/shared/navigation/product-nav.ts` registers the admin panel; `apps/web/shared/components/AccountDrawer.tsx` links to `/admin`; `apps/web/shared/auth/panelAccess.ts` lists tenant-admin role slugs; `apps/web/shared/auth/panelAccess.test.ts` covers the panel role map and denials. |
| `/agency` | `apps/web/app/(panels)/agency/page.tsx` re-exports `apps/web/agency/AgencyEntryPage.tsx` | Calls `requirePanelAccess("agency")`, then renders only "Agency access is confirmed." No agency workspace workflow is present. | `product-nav.ts` registers an agency root; `panelAccess.ts` maps `agency` and `org-agency`; the panel-role tests cover generic panel access, not agency workflow behavior. |
| `/reseller` | `apps/web/app/(panels)/reseller/page.tsx` re-exports `apps/web/reseller/ResellerEntryPage.tsx` | Calls `requirePanelAccess("reseller")`, then renders only "Reseller access is confirmed." No reseller workspace workflow is present. | `product-nav.ts` registers a reseller root; `panelAccess.ts` maps `reseller` and `org-reseller`. |
| `/partner` | `apps/web/app/(panels)/partner/page.tsx` re-exports `apps/web/partner/PartnerEntryPage.tsx` | Calls `requirePanelAccess("partner")`, then renders only "Partner access is confirmed." No partner workspace workflow is present. | `product-nav.ts` registers a partner root; `panelAccess.ts` maps `partner` and `org-partner`. |

`PANEL_ROLE_REQUIREMENTS` also declares a `network` role group in `apps/web/shared/auth/panelAccess.ts`. That is policy wiring only; it is not proof that a `network` app or route exists.

## Business-reporting and finance routes

These are tenant-side routes in the `(panels)` route group. Their route files re-export implementations from `apps/web/dashboard/routes/`. They are distinct from platform analytics and from the platform scheduled-report module.

| Shipped path | Implementation | Backend dependencies evidenced in source | Notes |
|---|---|---|---|
| `/analytics` | `apps/web/app/(panels)/analytics/page.tsx` | None (compatibility `redirect("/insights/analytics")`) | Keep the redirect; it is a shipped alias. |
| `/insights/analytics` | `apps/web/dashboard/routes/insights/analytics/page.tsx` | `markets.listMarkets`; `analytics.getRevenueTrend`, `getSubscriberTrend`, `getTopAgents`, `getSalesMix` | Tenant analytics implementation. `product-nav.ts` links to the `/analytics` compatibility alias, not this path directly; `content-nav.ts` has no analytics entry. |
| `/sales` | `apps/web/dashboard/routes/sales/page.tsx` | `analytics.getSalesMix`, `getTopAgents` | Tenant sales implementation. |
| `/revenue` | `apps/web/dashboard/routes/revenue/page.tsx` | `markets.listMarkets`, `analytics.getRevenueTrend` | Labeled "Payments" in the tenant billing group of `product-nav.ts` and `content-nav.ts`. |
| `/profit-loss` | `apps/web/dashboard/routes/profit-loss/page.tsx` | `markets.listMarkets`, `expenses.listAllFinancials`, `costAllocation.getCostAllocation` | Tenant financial reporting. |
| `/profitability` | `apps/web/dashboard/routes/profitability/page.tsx` | `markets.listMarkets`, `expenses.listAllFinancials` | Tenant financial reporting. |
| `/investor-reports` | `apps/web/dashboard/routes/investor-reports/page.tsx` | `markets.listMarkets`; `investors.getInvestorOverview`, `listInvestors`, `listInvestorReports`; mutations `createInvestor`, `updateInvestor`, `generateInvestorReportForAdmin` | Tenant investor reports; UI checks `investors:manage` before management controls. Separate from platform scheduled reports. |
| `/scheduled-reports` | `apps/web/dashboard/routes/scheduled-reports/page.tsx` | `scheduledReports.listScheduledReports`, `listReportExports`; mutations `createScheduledReport`, `updateScheduledReport`, `deleteScheduledReport` | Tenant scheduled reporting/export workflow; not the platform scheduled-report module. |
| `/commissions` | `apps/web/dashboard/routes/commissions/page.tsx` | Commission query plus `agents.listAgents`, `markets.listMarkets`; payout request/approve/process/mark-paid/dispute mutations | Tenant commission and payout workflow, not the platform commission modules. `/commissions` is also a platform path prefix, so panel ownership must be preserved explicitly in any migration. |
| `/finance/invoices` | `apps/web/dashboard/routes/finance/invoices/page.tsx` | `invoices.list`, `getStats`, `subscribers.list`; mutations `create`, `issue`, `markPaid`, `cancel` | Tenant customer billing. Not tenant SaaS invoices. UI checks the corresponding invoice permissions. |
| `/finance/payments` | `apps/web/dashboard/routes/finance/payments/page.tsx` | `payments.list`, `getStats`, `subscribers.list`; mutations `create`, `refund` | Tenant customer payments. `/revenue` is the current nav entry; preserve this route and its direct-URL behavior. UI checks `payments:create` and `payments:refund`. |

## No-deletion disposition and migration gate

1. Retain the four legacy panel routes and all listed business-reporting and finance routes in `apps/web` while the target applications are built and split.
2. Keep tenant `/admin` administration distinct from the planned `apps/network` `/admin` surface. Route and hostname ownership require an explicit mapping before either path changes.
3. Keep tenant `/scheduled-reports` and `/commissions` distinct from the platform scheduled-report and commission modules, even where labels or route prefixes overlap.
4. Before any retirement, record an owner-approved destination for every path, inventory inbound links beyond this source tree (email, notifications, bookmarks, API consumers), verify redirect and page/data/permission parity, and run authenticated route and backend tests for every mapped role.
5. This audit authorizes no deletion, redirect, move, or rewrite. A separate implementation decision and review are required after replacement behavior is proven.

## Enforcement

`scripts/audit/legacy-route-no-deletion.test.mjs` (run by the repository `test` script) asserts that every facade and implementation file listed above still exists and that each facade still wires to the expected implementation. Removing or rewiring a protected surface fails the suite until this audit and its guard are deliberately updated with an owner-approved disposition.
