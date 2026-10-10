---
title: Tenant Panel Feature Audit
status: active
date: 2026-10-10
---

# Tenant Panel Feature Audit

Audit of the MylesNet tenant panel (ISP dashboard) against
`docs/tenant-panel-feature-list.md`. Evidence is current-repo only (branch
`feat/tenant-panel-program`, base `origin/main` at commit `eb119ee`).

## Stack (identified from the repo, not assumed)

- Web: Next.js (App Router) in `apps/web`, TypeScript, React, Tailwind v4 with
  shared design tokens (`packages/ui`, `apps/web/shared/design`).
- Backend: Convex (`convex/`), schema in `convex/schema.ts`, functions
  `query`/`mutation`/`action`, crons in `convex/crons.ts`.
- Auth: WorkOS AuthKit, mapped server-side to tenants through
  `convex/lib/auth.ts` and `convex/lib/permissions.ts`.
- Monorepo: pnpm + Turborepo (`apps/*`, `packages/*`, `services/*`,
  `infrastructure/*`).
- Tests: `node --test` for Convex/shared pure logic; Jest for UI
  (`apps/web`, partial).
- Deployment: Vercel (web) + a separate Convex deployment; see
  `docs/production-deployment.md`.

Status scale: **Done** (real UI + real backend + wired + tests where relevant),
**Partial** (some real pieces, incomplete), **Broken** (exists but does not
work), **Missing** (no implementation). "platform-only" means the capability
lives in the MylesCorp platform panel, not the tenant panel, so it does not
satisfy the tenant feature.

## Summary

The tenant panel today is a real but narrow billing and operations workspace.
The overwhelming majority of the feature list is Partial or Missing. Very few
features meet the section 11 definition of done.

Counts are the totals of the per-ID rows in section 5 and section 6 below, and
sum to the 331 features in the catalogue.

| Area | Done | Partial | Broken | Missing |
|---|---|---|---|---|
| Cross-cutting XC (22) | 2 | 15 | 0 | 5 |
| ONB (11) | 2 | 4 | 0 | 5 |
| DSH (8) | 1 | 2 | 0 | 5 |
| SUB (19) | 0 | 7 | 0 | 12 |
| PAU (10) | 0 | 0 | 0 | 10 |
| PKG (13) | 0 | 3 | 0 | 10 |
| BIL (13) | 0 | 6 | 0 | 7 |
| PAY (17) | 0 | 5 | 0 | 12 |
| CMP (9) | 0 | 0 | 0 | 9 |
| ACC (9) | 0 | 3 | 0 | 6 |
| SES (7) | 0 | 1 | 0 | 6 |
| NET (19) | 0 | 3 | 0 | 16 |
| OUT (9) | 0 | 0 | 0 | 9 |
| FIB (5) | 0 | 0 | 0 | 5 |
| CPE (4) | 0 | 0 | 0 | 4 |
| MAP (5) | 0 | 1 | 0 | 4 |
| WRK (9) | 0 | 0 | 0 | 9 |
| AST (6) | 0 | 0 | 0 | 6 |
| VCH (9) | 0 | 6 | 0 | 3 |
| AGT (11) | 0 | 5 | 0 | 6 |
| LED (6) | 0 | 0 | 0 | 6 |
| SUP (9) | 0 | 2 | 0 | 7 |
| COM (9) | 0 | 2 | 0 | 7 |
| AUT (5) | 0 | 0 | 0 | 5 |
| SVY (4) | 0 | 0 | 0 | 4 |
| LOY (5) | 0 | 1 | 0 | 4 |
| ENT (6) | 0 | 0 | 0 | 6 |
| VEN (4) | 0 | 0 | 0 | 4 |
| MKT (9) | 0 | 0 | 0 | 9 |
| CRS (7) | 0 | 0 | 0 | 7 |
| HRM (5) | 0 | 1 | 0 | 4 |
| RPT (6) | 0 | 3 | 0 | 3 |
| CPL (6) | 0 | 0 | 0 | 6 |
| ADD (4) | 0 | 0 | 0 | 4 |
| AIX (4) | 0 | 0 | 0 | 4 |
| IMP (4) | 0 | 0 | 0 | 4 |
| API (4) | 0 | 0 | 0 | 4 |
| SET (15) | 0 | 8 | 0 | 7 |
| NTF (2) | 0 | 0 | 0 | 2 |
| AUD (2) | 0 | 1 | 1 | 0 |
| **Total (331)** | **5** | **79** | **1** | **246** |

Highest-priority foundation gaps (build order step 1): tenant isolation holes
in `analytics.ts`, `scheduledReports.ts`, `notifications.ts`; the tenant audit
log is Broken because `logAudit` never writes `tenantId`; no i18n scaffolding
(XC-09); no rate limiting (XC-15); no idempotency on money mutations (XC-19).

## 5. Cross-cutting (XC)

| ID | Status | Evidence | Notes |
|---|---|---|---|
| XC-01 | Partial | `convex/lib/tenantIsolationCore.test.ts`; `convex/subscribers.ts` scoped reads | `analytics.ts`, `scheduledReports.ts`, `notifications.ts` are not tenant-filtered (exposure risk) |
| XC-02 | Done | `convex/lib/auth.ts` `requirePermission`/`requireTenantPermission` on tenant handlers | Convex is the authority |
| XC-03 | Partial | Arg validators on most mutations | Some `v.any()` (scopeFilter); no shared schema layer |
| XC-04 | Partial | Cursor pagination only in `auditLogTenant.ts` | Most lists `.collect()` + in-memory filter; no saved filters |
| XC-05 | Partial | `scheduledReports.ts` CSV; "PDF" is an HTML blob | No per-list export |
| XC-06 | Partial | softDelete/restore on subscribers, markets, tickets, roles, users | No 30-day window, no restore screen |
| XC-07 | Partial | `convex/lib/auditLog.ts` logAudit called in ~30 files | logAudit does not write tenantId; many mutations skip logging |
| XC-08 | Partial | `convex/forex.ts`, `exchangeRates`, per-tenant currency | Amounts are major-unit numbers, not integer minor units |
| XC-09 | Missing | No i18n/locale/translation keys anywhere | English only; no FR/SW/AR-RTL/PT |
| XC-10 | Partial | `tenant.timezone` via Intl; `formatDateTime` | No E.164 normalisation |
| XC-11 | Done | `app/layout.tsx` theme script; dark tokens; `ThemeToggle` | Token-driven |
| XC-12 | Partial | Media queries in `globals.css`/`packages/ui` | No lazy-loading audit |
| XC-13 | Partial | aria labels in topbar/drawer | Not systematic |
| XC-14 | Partial | Convex `useQuery` reactivity | No live sessions/alerts feed |
| XC-15 | Missing | No rate-limit code | Public and sensitive endpoints unthrottled |
| XC-16 | Missing | Topbar palette searches routes only | No entity search |
| XC-17 | Partial | `convex/notifications.ts` prefs; `lib/notify.ts` transport | No centre UI, no unread count, notifyUser unused |
| XC-18 | Missing | No bulk selection/actions | |
| XC-19 | Partial | `workosWebhook.ts` idempotent | `payments.create` has no idempotency key |
| XC-20 | Partial | Cmd+K palette | Navigation only |
| XC-21 | Partial | Offline banner | No queue/sync |
| XC-22 | Missing | Fixed table columns | No saved views/density |

## 6.1 ONB Onboarding

| ID | Status | Evidence | Notes |
|---|---|---|---|
| ONB-01 | Partial | `app/(onboarding)/signup`, `signup.ts` begin/requestCode/verifyCode | Email OTP only; no phone/WhatsApp OTP |
| ONB-02 | Partial | `OrganizationStep.tsx`, `DefaultsStep.tsx`, `signup.ts checkSlug` | No language field |
| ONB-03 | Missing | `DefaultsStep.tsx` collects country/timezone/currency only | No service types/billing cycle/payment methods/tax |
| ONB-04 | Partial | `SecureStep.tsx`, `signup.ts setPasswordAndConsent` | Consent timestamp only, no terms version |
| ONB-05 | Done | `ProvisioningScreen.tsx`, `signup.ts provisionStep`, `provisioningCore.test.ts` | Real progress + retry |
| ONB-06 | Done | `dashboard.getSetupStatus`, `TenantWorkspace.tsx` LaunchChecklist | Data-driven |
| ONB-07 | Missing | No invite step in signup wizard | Staff invite is platform `/access` |
| ONB-08 | Missing | No custom domain/DNS code | |
| ONB-09 | Partial | Read-only entitlement in `TenantWorkspace.tsx` | Management platform-only |
| ONB-10 | Missing | No guided tours/tips | |
| ONB-11 | Missing | No migration step in signup | Platform tooling only |

## 6.2 DSH Dashboard home

| ID | Status | Evidence | Notes |
|---|---|---|---|
| DSH-01 | Partial | `dashboard.getMetrics`; `TenantWorkspace.tsx` cards | Missing MRR, periods, churn, overdue, sessions, devices, outages |
| DSH-02 | Missing | Charts only on `/analytics` | Home has no charts |
| DSH-03 | Missing | None | No alerts panel |
| DSH-04 | Missing | Links to /subscribers and /plans only | No quick actions |
| DSH-05 | Missing | None | No site switcher |
| DSH-06 | Partial | Reactive `useQuery` | No alerts/device push |
| DSH-07 | Done | `dashboard.getSetupStatus` + LaunchChecklist | |
| DSH-08 | Missing | Fixed layout | No widgets |

## 6.3 SUB Subscribers

| ID | Status | Evidence | Notes |
|---|---|---|---|
| SUB-01 | Partial | `convex/subscribers.ts list`; `/subscribers` search/status/type | No site/agent/balance/expiry/tags filters, no saved filters, no pagination, no bulk |
| SUB-02 | Partial | `/subscribers/new`, `/[id]/edit` | Identity/contact only; no address/map/notes/tags/groups |
| SUB-03 | Missing | Single planId/connectionType row | No services table |
| SUB-04 | Partial | status enum via subscribers.update | No legal transitions/reason |
| SUB-05 | Partial | `subscriberDetail.ts getDetail`; `/subscribers/[id]` | Missing services/sessions/tickets/devices/docs/notes/pause/comp |
| SUB-06 | Partial | Generic update status select | No dedicated suspend/reactivate/reason/schedule |
| SUB-07 | Partial | planId changeable | No proration |
| SUB-08 | Partial | username/macAddress fields | No credential reset/device/session limits |
| SUB-09 | Missing | No KYC | |
| SUB-10 | Missing | No per-subscriber consent | |
| SUB-11 | Missing | No bulk import/export | |
| SUB-12 | Missing | No profile messaging | |
| SUB-13 | Missing | No termination flow | |
| SUB-14 | Missing | No relocation workflow | |
| SUB-15 | Missing | No merge | |
| SUB-16 | Missing | No transfer | |
| SUB-17 | Missing | No family/shared accounts | |
| SUB-18 | Missing | No view-as-subscriber | |
| SUB-19 | Missing | No lifecycle automations | |

## 6.4 PAU Subscription pause

All PAU-01 to PAU-10 are **Missing**. No pause schema, function, rule,
scheduling, enforcement, history, or analytics exists.

## 6.5 PKG Packages

| ID | Status | Evidence | Notes |
|---|---|---|---|
| PKG-01 | Missing | plans.category only data/tv/home_bundle | No network type |
| PKG-02 | Partial | `plans.ts`, schema plans | Missing speed/burst/cap/throttle/device limit |
| PKG-03 | Partial | plans.status active/inactive | No draft/archived/visibility |
| PKG-04 | Missing | No promo | |
| PKG-05 | Missing | No time-of-day | |
| PKG-06 | Missing | No bundles | |
| PKG-07 | Missing | No tax fields | |
| PKG-08 | Partial | `plans.updatePlan` | No scope/preview |
| PKG-09 | Missing | | |
| PKG-10 | Missing | | |
| PKG-11 | Missing | | |
| PKG-12 | Missing | | |
| PKG-13 | Missing | | |

## 6.6 BIL Billing

| ID | Status | Evidence | Notes |
|---|---|---|---|
| BIL-01 | Missing | No scheduler; autoInvoice setting unused | Major units, not minor |
| BIL-02 | Partial | `invoices.ts`, `/finance/invoices` | No PDF/SMS/WhatsApp/email; client numbering |
| BIL-03 | Missing | No proration | |
| BIL-04 | Missing | No grace/auto-suspend/reactivate | |
| BIL-05 | Missing | Reminder template only | |
| BIL-06 | Partial | `payments.refund` + UI | No credit note/write-off/approval |
| BIL-07 | Partial | walletBalance, creditAccount | No top-up/statement/auto-pay; creditAccount unlogged |
| BIL-08 | Missing | No billing runs | |
| BIL-09 | Partial | Single tax number | No tax reg/breakdown/sequence |
| BIL-10 | Partial | Subscriber invoices tab | No aged receivables |
| BIL-11 | Partial | status draft/issued/paid/overdue/cancelled | Missing sent/viewed/partial/void/disputed |
| BIL-12 | Missing | | |
| BIL-13 | Missing | | |

## 6.7 PAY Payments

| ID | Status | Evidence | Notes |
|---|---|---|---|
| PAY-01 | Partial | `payments.create` + `/finance/payments` stores method string | No gateway integration |
| PAY-02 | Missing | No gateway credentials | |
| PAY-03 | Missing | No reconciliation | |
| PAY-04 | Partial | create + UI | Missing invoice/wallet select, receiver, proof |
| PAY-05 | Missing | No allocation/partial/split | |
| PAY-06 | Missing | No receipts | |
| PAY-07 | Missing | No approvals | |
| PAY-08 | Partial | `payments.refund` | No correction/reversal record |
| PAY-09 | Missing | | |
| PAY-10 | Missing | No duplicate reference check | |
| PAY-11 | Missing | No cash-up | |
| PAY-12 | Partial | list filters + UI | No export/disputes |
| PAY-13 | Partial | failed status only | No retries |
| PAY-14 | Missing | | |
| PAY-15 | Missing | | |
| PAY-16 | Missing | | |
| PAY-17 | Missing | | |

## 6.8 CMP Compensation

All CMP-01 to CMP-09 are **Missing**.

## 6.9 ACC Accounting

| ID | Status | Evidence | Notes |
|---|---|---|---|
| ACC-01 | Partial | `expenses.ts` + UI | Missing vendor/tax/date/receipt UI/payment status |
| ACC-02 | Partial | revenue, expenses, profit-loss pages | No single per-site summary |
| ACC-03 | Missing | No QuickBooks/Xero/CSV | |
| ACC-04 | Missing | No ledger | |
| ACC-05 | Missing | | |
| ACC-06 | Partial | profit-loss per market | No balance sheet |
| ACC-07 | Missing | | |
| ACC-08 | Missing | | |
| ACC-09 | Missing | | |

## 6.10 SES Sessions

| ID | Status | Evidence | Notes |
|---|---|---|---|
| SES-01 | Partial | `networkOps.listLiveSessions`; `/network` | Derived from ledger, no real sessions |
| SES-02 | Missing | | |
| SES-03 | Missing | | |
| SES-04 | Missing | | |
| SES-05 | Missing | | |
| SES-06 | Missing | | |
| SES-07 | Missing | | |

## 6.11 NET Network

| ID | Status | Evidence | Notes |
|---|---|---|---|
| NET-01 | Partial | `markets.ts`, `/markets`, `networkOps.listSites` | No power/contacts/staff |
| NET-02 | Partial | `fleet.ts`, schema platformDevices | Platform-only |
| NET-03 | Partial | `fleet.registerDevice`, `provisioning.ts` | Platform-only |
| NET-04 | Missing | | |
| NET-05 | Missing | | |
| NET-06 | Missing | | |
| NET-07 | Missing | Static lastSeenAt/uptimePercent | No monitor |
| NET-08 | Missing | | |
| NET-09 | Missing | | |
| NET-10 | Missing | | |
| NET-11 | Missing | | |
| NET-12 | Missing | | |
| NET-13 | Missing | Map is country list | |
| NET-14 | Missing | | |
| NET-15 | Missing | | |
| NET-16 | Missing | | |
| NET-17 | Missing | | |
| NET-18 | Missing | | |
| NET-19 | Missing | | |

## 6.12 OUT Outages

All OUT-01 to OUT-09 are **Missing**.

## 6.13 FIB Fibre

All FIB-01 to FIB-05 are **Missing**.

## 6.14 CPE Customer routers

All CPE-01 to CPE-04 are **Missing**.

## 6.15 MAP Coverage

| ID | Status | Evidence | Notes |
|---|---|---|---|
| MAP-01 | Partial | `/map` groups sites by country | No real map render |
| MAP-02 | Missing | | |
| MAP-03 | Missing | | |
| MAP-04 | Missing | | |
| MAP-05 | Missing | | |

## 6.16 WRK Work orders

All WRK-01 to WRK-09 are **Missing**.

## 6.17 AST Assets

All AST-01 to AST-06 are **Missing**.

## 6.18 VCH Vouchers

| ID | Status | Evidence | Notes |
|---|---|---|---|
| VCH-01 | Partial | `generateVoucherBatch` + `/vouchers` | No prefix/batch expiry/agent assign |
| VCH-02 | Partial | voucherStatus union | Lacks generated/voided |
| VCH-03 | Missing | No scratch card/QR/PDF | |
| VCH-04 | Partial | `markVoucherSold` + commission | No float deduction |
| VCH-05 | Partial | staff `redeemVoucher` | Captive portal/subscriber panel absent |
| VCH-06 | Partial | `voucherFraud.ts` + `/platform/vouchers/monitor`; core test | Platform-only fraud monitor; no tenant voucher fraud surface, so the tenant feature is still owed |
| VCH-07 | Partial | `/sales` + analytics | No voucher report |
| VCH-08 | Missing | | |
| VCH-09 | Missing | | |

## 6.19 AGT Agents

| ID | Status | Evidence | Notes |
|---|---|---|---|
| AGT-01 | Partial | `/agents`, schema agents | No territory/tier/float limit |
| AGT-02 | Missing | No float | |
| AGT-03 | Missing | No cash-up | |
| AGT-04 | Partial | `commissions.ts` | No per-package/renewal/tier rules/statements |
| AGT-05 | Partial | `commissions.ts` + `payouts.ts` + tiered approval UI | No mobile-money or bank-transfer payout |
| AGT-06 | Partial | `/sales`, leaderboard | No targets |
| AGT-07 | Partial | `allocateVoucherToAgent` | No subscriber→agent |
| AGT-08 | Missing | | |
| AGT-09 | Missing | Reseller stub | |
| AGT-10 | Missing | | |
| AGT-11 | Missing | | |

## 6.20 LED Leads

All LED-01 to LED-06 are **Missing**.

## 6.21 SUP Support

| ID | Status | Evidence | Notes |
|---|---|---|---|
| SUP-01 | Partial | `/tickets` + `supportTickets.ts` | No categories/SLA/attachments/notes/merge/links |
| SUP-02 | Partial | Staff new-ticket form | No other intake |
| SUP-03 | Missing | | |
| SUP-04 | Missing | | |
| SUP-05 | Missing | | |
| SUP-06 | Missing | | |
| SUP-07 | Missing | | |
| SUP-08 | Missing | | |
| SUP-09 | Missing | | |

## 6.22 COM Communications

| ID | Status | Evidence | Notes |
|---|---|---|---|
| COM-01 | Missing | Sender via env only | |
| COM-02 | Partial | `workspaceSettings.ts` 2 templates | No languages/approval |
| COM-03 | Missing | comms page broadcasts to agents only | |
| COM-04 | Missing | notifyUser never called | |
| COM-05 | Missing | signup consent only | |
| COM-06 | Partial | `broadcastDeliveryLogs` | |
| COM-07 | Missing | | |
| COM-08 | Missing | | |
| COM-09 | Missing | | |

## 6.23 AUT Automation

All AUT-01 to AUT-05 are **Missing**.

## 6.24 SVY Surveys

All SVY-01 to SVY-04 are **Missing**.

## 6.25 LOY Loyalty

| ID | Status | Evidence | Notes |
|---|---|---|---|
| LOY-01 | Missing | Landing affiliate page only | |
| LOY-02 | Missing | | |
| LOY-03 | Missing | | |
| LOY-04 | Partial | `leaderboard.ts` | Backend only, no UI |
| LOY-05 | Missing | | |

## 6.26 ENT Enterprise

All ENT-01 to ENT-06 are **Missing**.

## 6.27 VEN Venues

All VEN-01 to VEN-04 are **Missing**.

## 6.28 MKT Marketplace

All MKT-01 to MKT-09 are **Missing**.

## 6.29 CRS Courses

All CRS-01 to CRS-07 are **Missing**.

## 6.30 HRM Staff

| ID | Status | Evidence | Notes |
|---|---|---|---|
| HRM-01 | Missing | Platform `/access` only | Not tenant HR |
| HRM-02 | Missing | | |
| HRM-03 | Missing | | |
| HRM-04 | Missing | | |
| HRM-05 | Partial | `analytics.getTopAgents` | Agent-side only |

## 6.31 RPT Reports

| ID | Status | Evidence | Notes |
|---|---|---|---|
| RPT-01 | Partial | `/analytics`, `/investor-reports`, `/scheduled-reports` | No consolidated reports |
| RPT-02 | Partial | market filter; CSV export | No filter set, no real PDF |
| RPT-03 | Partial | `scheduledReports.ts` + crons | Email never sent |
| RPT-04 | Missing | | |
| RPT-05 | Missing | | |
| RPT-06 | Missing | | |

## 6.32 CPL Compliance

All CPL-01 to CPL-06 are **Missing**. CPL-06 (country adapters for additional
markets) has no implementation.

## 6.33 ADD Add-ons

All ADD-01 to ADD-04 are **Missing**.

## 6.34 AIX Insights

All AIX-01 to AIX-04 are **Missing**.

## 6.35 IMP Import

All IMP-01 to IMP-04 are **Missing**.

## 6.36 API Developers

All API-01 to API-04 are **Missing**.

## 6.37 SET Settings

| ID | Status | Evidence | Notes |
|---|---|---|---|
| SET-01 | Partial | `workspaceSettings.ts`; settings route stub | No address/tax/logo |
| SET-02 | Partial | brandColor only | No logo/domain/senders |
| SET-03 | Partial | `invitations.ts`, `platformUsers.ts`, `/access` | Platform-only; no force sign-out |
| SET-04 | Partial | `rolesAdmin.ts`, `RoleEditor` | Platform-only; no money limits |
| SET-05 | Partial | `lib/mfa.ts`, PlatformSecurity | Platform-only, read-only |
| SET-06 | Partial | billing autoInvoice/prefix/wallet | No cycles/grace/reminders/tax |
| SET-07 | Missing | | |
| SET-08 | Missing | notifications.ts prefs unwired | |
| SET-09 | Missing | | |
| SET-10 | Partial | workos readiness owner-only | |
| SET-11 | Missing | | |
| SET-12 | Partial | entitlement read-only; platform manage | |
| SET-13 | Missing | | |
| SET-14 | Missing | | |
| SET-15 | Missing | | |

## 6.38 NTF and AUD

| ID | Status | Evidence | Notes |
|---|---|---|---|
| NTF-01 | Missing | notifications.ts prefs only | No centre UI |
| NTF-02 | Missing | `lib/notify.ts` SMS/email, unused | No push/WhatsApp/in-app |
| AUD-01 | **Broken** | `auditLogTenant.ts` filters tenantId; `lib/auditLog.ts` never writes tenantId | Tenant query returns empty; no search/export |
| AUD-02 | Partial | logAudit call sites in ~30 files; hash chain | Rows lack tenantId; exports not logged |

## Known baseline failures

Baseline at `origin/main` `eb119ee`: `pnpm typecheck` clean, `pnpm test`
171/171 pass. No baseline failures observed for these gates.

## Next work (derived from this audit)

1. Foundation: tenant isolation on `analytics.ts`, `scheduledReports.ts`,
   `notifications.ts`; tenant audit log `tenantId` write path; i18n scaffolding;
   money safety (minor units, idempotency keys); rate limiting.
2. Then P1 modules in the section 9 build order.
