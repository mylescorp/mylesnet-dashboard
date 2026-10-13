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

