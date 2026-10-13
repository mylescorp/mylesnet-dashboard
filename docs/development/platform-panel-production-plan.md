# Platform panel production plan

**Status:** implementation roadmap, based on the repository state reviewed 2026-10-01.
**Scope:** `/platform`, the MylesCorp control plane. Shared network operations stay in `/admin`; tenant ISP operations stay in `/dashboard`.

## Current baseline

The panel already has tenant provisioning and lifecycle controls, tenant detail and membership visibility, plan entitlements, platform access management, paginated audit history with hash-chain health, security and webhook summaries, feature flags, a voucher anomaly monitor, and initial device fleet/provisioning surfaces. These are implemented in the existing single Next.js app with Convex functions. They are not all deployment-ready: several functions and schema additions still require an explicit Convex deployment-boundary sync, and the checkout is 11 commits behind `origin/main` with local changes present.

All access management is consolidated on `/platform/access`. Authorized administrators receive the existing full users/roles/invitations UI; users with read-only platform access receive the scoped summary. `/access` remains a compatibility redirect only.

The subscription screen manages entitlements only. It does not issue SaaS invoices or record subscription payments. Tenant SaaS invoice handling is explicitly excluded as C2. The approved billing scope here is the C1 platform revenue dashboard; its MRR/ARR data source must be reconciled to the actual subscription/plan model before reporting is built. Support impersonation, platform API keys, and data requests remain gated by prerequisites.

## Delivery sequence

### 0. Release boundary and authorization correctness

- Keep every page behind `requirePanelAccess("platform")` and every Convex read/write behind its own platform role or permission check.
- Make action visibility match backend capabilities. The tenant lifecycle and entitlement mutations permit `platform_owner`, `platform_admin`, and `ops_manager`; the UI must expose those actions to the same roles and hide them from read-only/support roles.
- Reconcile the MFA policy before production: `docs/auth/README.md` and the September 13 decision call privileged MFA mandatory, while current `convex/lib/mfa.ts` and tests make it optional for every role. Do not silently choose a policy in the UI.
- Validate the exact WorkOS organization, Convex deployment, webhook configuration, and environment before syncing new backend functions. Keep generated API bindings pinned until the target is verified.

**Exit criteria:** role matrix is documented and enforced on server and UI; unauthenticated, wrong-role, inactive-user, and unconfigured-backend states are checked; MFA policy has one approved source; live deployment target is identified.

### 1. Tenant lifecycle and onboarding

- Preserve the prior trial/active state on suspension and restore it explicitly. Keep the action audited and platform-sub-role guarded.
- A server-side dashboard layout now calls the authenticated workspace query before rendering dashboard children and invokes Next `forbidden()` for a suspended tenant; `authInterrupts` is enabled. Verify the actual HTTP 403 using an approved suspended test identity, audit every tenant function for suspension enforcement, and implement/prove the documented device billing/RADIUS degradation cascade.
- Platform tenant navigation, overview actions, and tenant list/detail links use the canonical `/platform/organizations` route aliases; the older `/platform/tenants` paths remain compatible.
- Finish the onboarding checklist: tenant record, WorkOS organization mapping, owner invitation, hostname, initial entitlement, and readiness state must reconcile before the workspace is described as ready.
- Add idempotent retry/recovery visibility for partial provisioning and invitation resend/replace with audit records.
- Keep suspension distinct from cancellation. Cancellation remains blocked until the retention/offboarding flow and retention period are approved.
- Show the actor, affected workspace, result, and audit reference for lifecycle actions.

**Exit criteria:** repeated requests do not duplicate tenant or identity records; partial WorkOS failures can be resumed or safely reviewed; suspended tenants are denied at the tenant authorization boundary; cancellation cannot bypass retention.

### 2. Platform revenue visibility (C1; implementation started, C2 excluded)

- Use the global platform plan catalogue as the shared price source for C3 plan management, C1 contracted MRR/ARR, and public pricing cards. The seeded approved baseline is Starter KES 500/month, Growth KES 1,400/month, Pro KES 3,500/month, with KES as base currency. Plan price mutations are audited; archived plans remain priced for existing entitlements.
- Label MRR/ARR as contracted value from active tenant status plus active entitlements. ARR is MRR × 12. Exclude trials, suspended tenants, and unpriced plan IDs; expose unpriced counts.
- Capture aggregate daily snapshots for trends. Snapshot records contain no subscriber/customer payment data.
- Do not build tenant SaaS invoice generation, invoice payment capture, or invoice reconciliation under C1; canonical C2 remains deferred.

**Exit criteria:** calculations match the approved price contract, unknown plans are not assigned invented prices, historical snapshots are idempotent, direct reads enforce SA/FIN/RO roles, and the figures clearly distinguish contracted value from cash collected.

### 3. Platform access and support

- Keep `/platform/access` as the single access-management surface; legacy `/access` redirects there. Keep the read-only surface role-scoped and leave mutation controls visible only when backend permissions allow them.
- Complete platform staff invitations, role assignment/revocation, pending invitation recovery, and periodic access review.
- Add time-limited, tenant-scoped support grants with purpose, approver, expiry, and audit trail. Support grants must not imply tenant membership or expand a user’s global role.
- Keep impersonation disabled until an explicit policy defines consent, visible session banner, scope, duration, restricted actions, and immutable audit evidence.
- Add platform service identities/API keys only after scope, rotation, last-used reporting, and revocation semantics are specified.

**Exit criteria:** no self-approval or privilege escalation; tenant support access expires automatically and is reviewable; access changes invalidate or refresh sessions; read-only roles cannot invoke writes directly.

### 4. Security, audit, and operations

- Retain the append-only audit log and scheduled full-chain verifier; alert on failed/stale verification and webhook retry/quarantine accumulation.
- Add operational runbooks and dashboards for WorkOS webhook delivery, onboarding failures, entitlement expiry, feature-flag changes, and support access.
- Add access export and data-request workflow only after privacy, retention, deletion, and evidence rules are approved.
- Prove backup/restore, incident response, dependency/security scanning, accessibility, and load behavior as release evidence.

**Exit criteria:** alert ownership and remediation are named; audit integrity is healthy and monitored; recovery evidence meets the documented RPO/RTO; sensitive fields are excluded from logs and exports unless specifically authorized.

### 5. Production rollout

- Reconcile this branch with the 11 newer upstream commits and review all local modifications before release.
- Run role-based UI and direct-function authorization checks, cross-tenant denial checks, onboarding retry tests, billing invariants, and production build gates.
- Deploy additive Convex schema/functions to a verified non-production target first; reconcile data and exercise rollback/recovery before production promotion.
- Verify WorkOS callbacks, MFA/session policy, domain and TLS, alert routing, backup restore, owner training, and support handoff.

**Exit criteria:** signed release review includes environment, evidence, limitations, owner, and remediation status. Local development success alone is not a production-readiness signal.

## Dependencies that cannot be inferred from code

- Approved privileged-role MFA enforcement policy and data-retention schedule. C2 tenant invoice generation is explicitly excluded from build.
- Verified WorkOS and Convex production deployment targets and credentials managed through their approved secret stores.
- Production alert destinations, incident owners, and support staffing.
- Owner approval and auditable guardrails for impersonation, API keys, deletion, and tenant offboarding.

## 2026-10-10 continuation — Tenant analytics isolation and activity ownership

Closed a verified tenant-boundary gap in `convex/analytics.ts`: tenant-facing snapshot trends, top-agent reports, and sales mix now authorize the active tenant, validate requested market ownership, and only read rows associated with its verified markets. Composite tenant/date and tenant/time indexes serve newly tagged rows; legacy untagged history is recovered through only the tenant's market indexes and de-duplicated. Agent activity writes now validate agent, market, assignment, optional voucher, and financial input ownership/shape, then stamp the market-derived `tenantId`; subscriber snapshot writes now stamp the same derived tenant ownership. Tests prove foreign tenant rows/markets are excluded, legacy rows require a verified market, and inactive/mixed-tenant assignments are rejected.

Verification: web and admin typechecks pass; lint passes with one existing `BandwidthCalculatorTool.tsx` warning; 45/45 repository tests pass; token checks and `git diff --check` pass. This does not complete the tenant-function audit: authenticated backend integration tests and verified deployment remain required. The internal tenantId backfill is still gated; untagged rows remain readable only through market ownership in these analytics paths. Continue the full role/tenant-scope audit and app split on `codex/platform-production`. Source files in the owner checkout remain untouched; its canonical work-log/plan copies now include this record.

## 2026-10-13 continuation — Platform MFA policy reconciled (Phase 0)

Reconciled the MFA conflict this plan flags as a Phase 0 exit criterion ("MFA policy has one approved source"). `convex/lib/mfa.ts` now requires MFA for every platform role, with the set derived from the role registry (`SYSTEM_ROLES` entries with `isPlatform: true`) so it cannot drift: `platform_owner`, `platform_admin`, `member`, `ops_manager`, `finance_manager`, `market_manager`, `investor_viewer`, `platform_support`, `platform_readonly`. `assertMfaCompliance` fails closed for an unenrolled platform role; an explicit `mfaEnrolled: false` denies even with a stale timestamp, and `syncWorkosIdentity` clears the timestamp when WorkOS reports the factor removed. `convex/lib/auth.ts` enforces the policy in every platform authorization gate, and the platform-wide (cross-tenant) report path enforces it in `scheduledReports.canReadPlatformReports` and the platform branch of `requireReportExportActor`; tenant-scoped reads/exports are unchanged. `docs/auth/README.md` and `docs/decisions.md` are the approved sources and also fix the session policy: 30-minute inactivity timeout, warning at 25 minutes, 12-hour absolute lifetime. Verification: web typecheck clean; 216/216 repository tests; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except 4 baseline test-file errors identical at `origin/main`; production build passed with a non-secret Convex URL placeholder. Greptile 5/5 on `abca864`; merged at `d5ea9be` (PR #93). Next Phase 0 task: implement and prove the session policy (client inactivity guard with the 25-minute warning and 12-hour absolute cap plus server session checks). The same-day Foundation work also landed payment-recording idempotency (PR #92, merged at `2d00cca`). This entry is mirrored to the vault `Reports/platform-panel-production-plan.md`; the owner checkout's 133-line plan draft was left untouched and should fold in this entry when it lands.

## 2026-10-13 continuation — Platform session policy enforced (Phase 0)

Implemented the session policy fixed alongside the MFA decision (30-minute inactivity timeout, 25-minute warning, 12-hour absolute lifetime) on top of the merged MFA work. The values live in exactly one module, `apps/web/shared/auth/sessionPolicy.ts` (`PLATFORM_SESSION_POLICY`), exported as pure evaluators (`evaluatePlatformSession`, `latestTimestamp`, `parseStoredTimestamp`, activity/start keys, `remainingMinutesLabel`) with 13 `node --test` cases covering the policy values, the active/warning/expired boundaries, absolute-cap precedence, clock skew, per-session key isolation, and timestamp parsing.

- **Server half:** `requirePanelAccess` now returns the `AuthSession`; the platform layout calls `platformSession.ts`, which compares the WorkOS `auth_time` against the 12-hour cap and redirects to the new `/sign-out` route (which ends the WorkOS session and returns to sign-in) when the cap has passed. `Date.now()` lives in that non-component module so the render path stays pure.
- **Browser half:** `SessionGuard` (mounted only by the platform layout, so tenant-panel behavior is unchanged) warns at 25 minutes, signs out at 30, and enforces the 12-hour cap in-page; activity is shared across tabs through `localStorage` keyed by the WorkOS `sessionId`, so an idle background tab is not signed out while another tab is active. The absolute cap prefers the server-supplied sign-in time and otherwise falls back to the first observed platform visit for that session. Two review-hardening rules keep the timeout honest: a page load counts as activity only while the stored activity is still inside the policy window (reopening a platform tab after the timeout ends the session instead of resuming it), and activity arriving after the window has closed ends the session instead of extending it. The expiry notice is modal (ported, focus moved to its sign-in action, Tab trapped, the page underneath hidden from assistive technology and made inert) and its action is `/sign-out`, so a failed automatic sign-out still has a working recovery path; a failed call clears the in-flight flag so the next check retries.

Verification: repository `node --test` 229/229 (13 new `sessionPolicy` cases); web jest 25/25 (10 new `SessionGuard` cases); web typecheck; lint 0 errors (14 pre-existing warnings outside the diff); design-token check; production build passed with a non-secret Convex URL placeholder. Greptile 5/5 on the hardened head `dcacce0` after one review round (one P0 idle-resume finding and two P2 sign-out/accessibility findings, all fixed); merged at `9c5c549` (PR #95). No new runtime dependency and no Convex schema/function change.

**Exit criteria update:** Phase 0's "MFA policy has one approved source" and the session policy it pairs with are now both enforced from one place. Remaining Phase 0 work: the documented role matrix/UI parity check and the verified deployment target (blocked by B-001). Next: the `apps/admin`/`apps/network` boundary extraction and the remaining Phase 1 lifecycle items.

## 2026-10-13 — Phase 1 no-deletion audit re-baselined

Re-baselined the separate no-deletion audit that gates the platform app-boundary work onto current `main`. The earlier audit (`docs/audits/legacy-route-no-deletion-audit-2026-10-09.md`) exists only on unmerged production branches whose `apps/admin` tree is absent from `main`, so the disposition was not grounded in the shipping code. This audit re-inventories the surfaces against `main` at `4dbf09f`.

- **Reviewed surfaces:** the `/admin`, `/agency`, `/reseller`, and `/partner` panel roots and the tenant business-reporting/finance routes (`/analytics` alias, `/insights/analytics`, `/sales`, `/revenue`, `/profit-loss`, `/profitability`, `/investor-reports`, `/scheduled-reports`, `/commissions`, `/finance/invoices`, `/finance/payments`) with their façade, implementation module, evidenced backend dependencies, references, and verification limits.
- **Current boundary:** `apps/` on `main` contains only `web` and `mobile`; `apps/admin` and `apps/network` are absent. The platform panel ships inside `apps/web` (23 platform `page.tsx` entries under `apps/web/app/(panels)/platform/`).
- **Enforcement:** `scripts/audit/legacy-route-no-deletion.test.mjs` fails when an audited façade or implementation disappears or a façade stops actively loading its audited module; it inspects active source only, so commented-out wiring does not pass. Removing a surface requires an owner-approved audit and matrix update first. The repository test job now runs `scripts/audit/*.test.mjs`.

**Disposition:** the audit authorizes no deletion, redirect, move, or rewrite. It requires an owner-approved destination, an inbound-link inventory beyond the source tree, redirect/page/data/permission parity, and authenticated role tests before any retirement.

Verification: repository `node --test` 234/234 (+5 guard cases); the guard was negative-tested (removing a façade, or commenting out its re-export, fails); lint 0 errors (14 pre-existing warnings outside the diff); web typecheck; design-token check. Merged at `b7123db` (PR #97).

**Next:** begin the `apps/admin` platform-panel boundary extraction as additive work (no legacy surface removed), keeping tenant `/admin` distinct from the planned `apps/network` surface; continue the Phase 0 role-matrix/UI parity check. Production deploy remains blocked by B-001.

## 2026-10-13 — Platform role matrix single-sourced and proven on server and UI (Phase 0)

Closed the Phase 0 exit criterion "role matrix is documented and enforced on server and UI", following the audit that unblocked the app-boundary work.

- **One source:** `convex/lib/platformAccess.ts` now holds the canonical platform gate matrix: read, operate, finance, revenue-read, voucher-monitor, fleet-read, analytics-read, and super-admin sub-role lists. Every Convex platform gate that repeated an array imports its list from this module (`tenantControl.ts`, `provisioning.ts`, `platformPlans.ts`, `platformMarkets.ts`, `platformRevenue.ts`, `scheduledReports.ts`, `voucherFraud.ts`, `tenantMigrations.ts`, `fleet.ts`, `markets.ts`, `featureFlags.ts`, `analytics.ts`), and every list resolves through the real `PLATFORM_SUB_ROLE_MAP`, so a spec-silent role is denied rather than implicitly allowed.
- **Proof on both sides:** `apps/web/platform/permissions.test.ts` imports the canonical lists, resolves them through the same map, and asserts the panel visibility helpers (`canManagePlatformTenants`, `canManagePlatformPlans`, `canDeletePlatformTenant`) agree for every concrete platform system role; it also proves the helpers fail closed with no roles and that no gate resolves to a non-platform role. Because the test consumes the same lists the gates use, a backend change flows into the guard instead of escaping a copied matrix. `package.json` runs `apps/web/platform/*.test.ts` in the repository test job.

Verification: repository `node --test` 242/242 (+8 parity cases); web jest 25/25; web typecheck; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except the 4 baseline test-file errors identical at `origin/main`; design-token check; production build passed with a non-secret Convex URL placeholder. The refactor is behavior-preserving; no schema, session, or UI-runtime change. Merged at `f9695f9` (PR #99).

**Exit criteria update:** Phase 0's "role matrix is documented and enforced on server and UI" is now satisfied from one source with a parity guard. Remaining Phase 0 work: the verified deployment target (blocked by B-001). Next: the additive `apps/admin` platform-panel boundary extraction (no legacy surface removed; keep tenant `/admin` distinct from the planned `apps/network` surface) and the remaining Phase 1 tenant-lifecycle items.
