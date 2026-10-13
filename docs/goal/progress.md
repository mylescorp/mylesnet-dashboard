---
title: Tenant Panel Program Progress
status: active
date: 2026-10-10
---

# Progress log

Newest entries last. Keep current after every step so a reset can resume.

## 2026-10-10 bootstrap

- Read repo `AGENTS.md`, vault `AGENTS.md`, `docs/vault-reference.md`,
  `docs/no-technology-stack-exposure.md`, `docs/decisions.md`, module register.
- Read the full feature list. Copied it to `docs/tenant-panel-feature-list.md`.
- Isolated worktree created at `/home/myles/Projects/mylesnet-tenant-panel`,
  branch `feat/tenant-panel-program` off `origin/main` `eb119ee`. The owner
  checkout `/home/myles/Projects/mylesnet-dashboard` was left untouched
  (it had uncommitted changes on `chore/greptile-pr-gate`).
- Baseline gates on the worktree: `pnpm typecheck` clean, `pnpm test` 171/171.
- Audited the whole panel against the feature list via repo evidence.
  Wrote `docs/tenant-panel-audit.md`. Result: the panel is a narrow billing
  workspace; the large majority of features are Partial or Missing. Only a
  handful meet the definition of done.
- Highest-priority foundation defects found: tenant isolation holes in
  `convex/analytics.ts`, `scheduledReports.ts`, `notifications.ts`; the tenant
  audit log is Broken (`logAudit` never writes `tenantId`, so the tenant audit
  query returns nothing); no i18n scaffolding; no rate limiting; no idempotency
  on `payments.create`.
- Wrote goal files: `docs/goal/goal.md`, `progress.md`, `decisions.md`,
  `blockers.md`, `lessons.md`.

### Heartbeat

- Time: 2026-10-10 bootstrap.
- Module: program bootstrap + audit.
- Result: audit complete, goal defined.
- Production URL: not deployed by this session (see `blockers.md`, production
  target/credentials unavailable).
- Next module: Foundation (tenant isolation + tenant audit log), then i18n.

- Next module: Foundation - i18n scaffolding, design tokens, tenant audit log,
  loading/error/empty patterns.

## 2026-10-12 Foundation work - PR #80 tenant read isolation merged

- Resumed PR #80 (feat/tenant-read-isolation) in an isolated worktree and
  rebased it onto the current `origin/main`.
- Fixed the live finding: scheduled exports now authorize the creator before
  reading data or storing a file, and delete the stored artifact if the writer
  still rejects (`canReadTenantReports`, `requireReportExportActor`).
- Resolved the stale outdated audit-entry thread with a reasoned reply; every
  ownership change and export write is audited.
- Greptile review passed and all CI checks passed; PR merged at `81a1803`
  (squash). Review record: vault `greptile-review/pr-80-tenant-read-isolation.md`.

## 2026-10-12 Foundation - PR #92 payment recording idempotency merged

- Made recording the same tenant payment twice a no-op using the natural
  `(tenantId, gateway, reference)` key (no new column): `payments.create`
  returns the existing row, `payments.update` normalizes the stored pair and
  rejects a key collision, and the create lookup falls back to the raw key for
  rows written before normalization. Added the `by_tenant_gateway_reference`
  index and a tested pure `paymentIdempotencyCore`.
- Verification: web typecheck clean; repository `node --test` 214/214; lint zero
  errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean
  except 4 baseline test-file errors identical at `origin/main`; `next build`
  passed using a non-secret placeholder for the Convex URL variable.
- Greptile 5/5 on head `1431477`; merged at `2d00cca` (squash). See PR #92.

## 2026-10-13 Phase 0 - Platform MFA policy enforced

- Reconciled the platform MFA policy to the owner-fixed decision and made it
  the single approved source. `convex/lib/mfa.ts` now requires MFA for every
  platform role (derived from `SYSTEM_ROLES` entries with `isPlatform: true`)
  and fails closed for an unenrolled platform role; an explicit
  `mfaEnrolled: false` denies even with a stale timestamp and
  `syncWorkosIdentity` clears the timestamp on removal. `convex/lib/auth.ts`
  enforces it in every platform authorization gate, and the platform-wide
  (cross-tenant) report path enforces it in `scheduledReports`.
  `docs/auth/README.md`, `docs/decisions.md`, and `docs/development/work-log.md`
  record the MFA position and the fixed session policy (30-minute inactivity,
  25-minute warning, 12-hour absolute). Tenant-facing handlers are unchanged.
- Verification: web typecheck clean; repository `node --test` 216/216; lint zero
  errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean
  except 4 baseline test-file errors identical at `origin/main`; `next build`
  passed using a non-secret placeholder for the Convex URL variable.
- Greptile 5/5 on head `abca864` after three review rounds (four P1 security
  findings total: incomplete platform-role coverage, removed-factor persistence,
  the report-export bypass, and tenant exports broken by the new check
  ordering - all fixed). Merged at `d5ea9be` (squash). See PR #93. Review
  record: vault `greptile-review/pr-93-platform-mandatory-mfa.md`.

### Heartbeat

- Time: 2026-10-13 platform Phase 0 session.
- Module: Foundation - platform Phase 0 (MFA policy enforced).
- Result: MFA is mandatory for every platform role and enforced in every platform gate; PR #92 and PR #93 merged.
- Production URL: not deployed (see `blockers.md` B-001).
- Next task: platform session enforcement (30-minute inactivity logout, 25-minute warning, 12-hour absolute lifetime); then continue the `apps/admin`/`apps/network` boundary extraction.

## 2026-10-13 Foundation - PR #95 platform session policy enforced

- Implemented the session policy fixed alongside the mandatory-MFA decision
  (30-minute inactivity timeout, 25-minute warning, 12-hour absolute lifetime)
  from a single source, `apps/web/shared/auth/sessionPolicy.ts`, with pure
  evaluators and 13 `node --test` cases (values, boundaries, absolute
  precedence, clock skew, per-session key isolation, timestamp parsing).
- Server half: `requirePanelAccess` returns the `AuthSession`; the platform
  layout calls `platformSession.ts`, which enforces the 12-hour cap from the
  WorkOS `auth_time` and redirects to the new `/sign-out` route (ends the
  WorkOS session, returns to sign-in). `Date.now()` lives in that non-component
  module so the render path stays pure.
- Browser half: `SessionGuard` (mounted only by the platform layout, so tenant
  panels are unchanged) warns at 25 minutes, signs out at 30, and enforces the
  cap in-page; activity is shared across tabs via `localStorage` keyed by the
  `sessionId`. Review hardening: a page load counts as activity only while the
  stored activity is still inside the window (reopening a platform tab after
  the timeout ends the session instead of resuming it), and activity arriving
  after the window closes ends the session instead of extending it. The expiry
  notice is modal (ported, focus moved, Tab trapped, background inert) and its
  action is `/sign-out`; a failed sign-out clears the in-flight flag and retries.
- Verification: repository `node --test` 229/229 (13 new cases); web jest 25/25
  (10 new `SessionGuard` cases); web typecheck; lint 0 errors (14 pre-existing
  warnings outside the diff); design-token check; production build passed with a
  non-secret Convex URL placeholder. No new runtime dependency and no Convex
  change.
- Greptile 5/5 on the hardened head `dcacce0` after one review round (one P0
  idle-resume finding, two P2 sign-out/accessibility findings, all fixed).
  Merged at `9c5c549` (squash). See PR #95.

### Heartbeat

- Time: 2026-10-13 platform Phase 0 session.
- Module: Foundation - platform Phase 0 (session policy enforced).
- Result: one policy source drives the server's 12-hour cap and the browser's 25-minute warning, 30-minute inactivity logout, and 12-hour cap; PR #95 merged.
- Production URL: not deployed (see `blockers.md` B-001).
- Next task: the `apps/admin`/`apps/network` boundary extraction and the remaining Phase 0 role-matrix/deployment-target work; then Phase 1 tenant lifecycle items.

## 2026-10-13 Foundation - PR #97 legacy route no-deletion audit

- Re-baselined the separate no-deletion audit that gates the platform
  app-boundary work onto current `main`, because the earlier audit exists only
  on unmerged production branches whose `apps/admin` tree is absent from `main`.
  Recorded the `/admin`, `/agency`, `/reseller`, `/partner` panel roots and the
  tenant business-reporting/finance routes with their façade, implementation
  module, evidenced backend dependencies, references, and verification limits.
  The disposition authorizes no deletion, redirect, move, or rewrite.
- Added `scripts/audit/legacy-route-no-deletion.test.mjs` and included
  `scripts/audit/*.test.mjs` in the repository test job. The guard strips
  comments and inspects active source only, so a commented-out re-export or
  redirect cannot pass; removing a surface requires an owner-approved audit and
  matrix update first. The guard was negative-tested.
- Verification: repository `node --test` 234/234 (+5 guard cases); lint zero
  errors (14 pre-existing warnings outside the diff); web typecheck;
  design-token check. No runtime, schema, or UI change.
- Merged at `b7123db` (squash). See PR #97.

### Heartbeat

- Time: 2026-10-13 platform Phase 0/1 session.
- Module: Phase 1 - legacy route no-deletion audit re-baselined.
- Result: the no-deletion audit is grounded in current `main` and enforced by a test; PR #95, #96, and #97 merged.
- Production URL: not deployed (see `blockers.md` B-001).
- Next task: begin the additive `apps/admin` platform-panel boundary extraction (keep tenant `/admin` distinct from the planned `apps/network` surface, remove no legacy surface); continue the Phase 0 role-matrix/UI parity check.

## 2026-10-13 Foundation - PR #99 platform role matrix single-sourced and proven

- Closed the Phase 0 "role matrix is documented and enforced on server and UI"
  criterion. Added `convex/lib/platformAccess.ts` as the canonical platform gate
  matrix; every Convex platform gate that repeated a sub-role array now imports
  its list from it, so access is declared once and resolved through the real
  `PLATFORM_SUB_ROLE_MAP`.
- Added `apps/web/platform/permissions.test.ts`, which imports those same lists,
  resolves them through the map, and asserts the panel visibility helpers
  (`canManagePlatformTenants`, `canManagePlatformPlans`,
  `canDeletePlatformTenant`) agree for every concrete platform system role. A
  backend gate change now flows into the guard instead of escaping a copied
  matrix; the guard also proves the helpers fail closed with no roles and that no
  gate resolves to a non-platform role. `package.json` includes
  `apps/web/platform/*.test.ts` in the repository test job.
- Verification: repository `node --test` 242/242 (+8 parity cases); web jest
  25/25; web typecheck; lint zero errors (14 pre-existing warnings outside the
  diff); convex-tree `tsc` clean except the 4 baseline test-file errors identical
  at `origin/main`; design-token check; production build passed with a non-secret
  Convex URL placeholder. The gate lists are behavior-preserving.
- Merged at `f9695f9` (squash). See PR #99.

### Heartbeat

- Time: 2026-10-13 platform Phase 0 session.
- Module: Foundation - platform Phase 0 (role matrix single-sourced and proven).
- Result: the platform access matrix is declared once and the panel UI is proven to agree with the Convex gates for every platform role; PR #98 and #99 merged.
- Production URL: not deployed (see `blockers.md` B-001).
- Next task: begin the additive `apps/admin` platform-panel boundary extraction (keep tenant `/admin` distinct from the planned `apps/network` surface, remove no legacy surface); finish the remaining Phase 0 deployment-target work and the Phase 1 tenant-lifecycle items.

