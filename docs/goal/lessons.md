---
title: Tenant Panel Program Lessons
status: active
date: 2026-10-10
---

# Lessons

Short, actionable notes so the next module avoids the same trap.

## 2026-10-10

- The feature list describes a target product far larger than the current repo.
  The tenant panel today is a narrow billing and operations workspace; treat
  "Partial" as "the UI or backend shell exists but the described behaviour does
  not". Do not reuse a platform-panel capability as a tenant feature.
- Separated surfaces matter: several capabilities (device fleet, provisioning,
  voucher fraud monitor, roles, invitations, entitlements) exist only in the
  MylesCorp platform panel, not the tenant panel. Always confirm which panel a
  feature must land in before counting it as done.
- `convex/lib/auditLog.ts` `logAudit` writes no `tenantId`, so the tenant audit
  log query (which filters on `tenantId`) returns empty. This is a foundation
  bug, not a feature gap. Fix before relying on the audit log for any module.
- Money is stored as major-unit numbers today, not integer minor units. Any
  billing or payment module must introduce integer minor units and idempotency
  before real money flows are enabled.
- Several tenant reads (`analytics.ts`, `scheduledReports.ts`,
  `notifications.ts`) are not tenant-filtered. Treat tenant scoping as a
  mandatory review checkpoint on every new backend function.
- The repo uses root-level panel routes under `app/(panels)`, not the
  `/dashboard/...` prefix in the feature list. Follow the repo convention and do
  not duplicate existing routes.
- Local gates are fast and green: `pnpm typecheck` and `pnpm test` run in
  seconds with the offline pnpm store, so run them after every change.
