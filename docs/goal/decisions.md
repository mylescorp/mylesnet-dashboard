---
title: Tenant Panel Program Decisions
status: active
date: 2026-10-10
---

# Decisions

Each entry: context, decision, alternatives, reversal. Open decisions from the
feature list section 10 are resolved here with the recommended default and
tagged NEEDS REVIEW. Nothing is hardcoded: defaults live in tenant-level
configuration so they are reversible.

## D-001 Program execution model - 2026-10-10

- Context: brief requires autonomous module-by-module delivery with a Greptile
  review gate and production deploy per module.
- Decision: execute on isolated worktree `/home/myles/Projects/mylesnet-tenant-panel`
  (branch `feat/tenant-panel-program`), one branch and PR per module, per the
  repo `AGENTS.md` gate.
- Alternatives: work in the dirty owner checkout (rejected: violates AGENTS.md).
- Reversal: none needed; worktrees are disposable.

## D-002 Production target - 2026-10-10 - NEEDS REVIEW

- Context: brief requires deploy to existing production after each module.
- Decision: use the repo's existing targets: web on Vercel, backend on the
  existing Convex production deployment. No new projects created.
- Reversal: change the deploy target in `docs/production-deployment.md`.
- Status: blocked. This checkout has no approved production Convex target or
  deploy credential, so no production deploy or live verification could run.
  See `blockers.md` B-001.

## D-003 Tenant role set (feature list section 10.1) - NEEDS REVIEW

- Default chosen: keep the existing mapped roles
  (`tenant_admin`, `tenant_manager`, `tenant_operator`, `tenant_viewer`,
  `member`) working, and extend the permission catalog so the section 3 role set
  (`tenant_owner`, `tenant_admin`, `finance_manager`, `support_agent`,
  `technician`, `sales_manager`, `field_agent`, `viewer`, custom roles) can be
  created as custom roles without a migration.
- Alternative: replace the role set outright (riskier; breaks existing
  memberships).
- Reversal: tenant role definitions live in `convex/lib/permissions.ts` and the
  `roles` table, both configuration-style edits.

## D-004 Payment aggregator (section 10.2) - NEEDS REVIEW

- Default chosen: build a gateway adapter boundary; recommended providers
  M-Pesa Daraja (Kenya), Airtel Money (Uganda/Tanzania), and a pan-African
  aggregator for cards/bank. Ship disabled until credentials exist.
- Reversal: provider selection is per-tenant gateway configuration.

## D-005 SMS/WhatsApp/USSD providers (section 10.3) - NEEDS REVIEW

- Default chosen: Africa's Talking for SMS/USSD and WhatsApp Cloud API for
  WhatsApp, matching existing env references and vault standards. Ship disabled
  until credentials exist.
- Reversal: per-tenant messaging provider configuration.

## D-006 Tax authority integration (section 10.4) - NEEDS REVIEW

- Default chosen: build against the certified-provider adapter model
  (Kenya eTIMS, Uganda URA EFRIS, Tanzania TRA VFMS) rather than direct
  integration. Ship disabled until credentials exist.
- Reversal: country adapter selection in tenant settings.

## D-007 Time-series and telemetry storage (section 10.5) - NEEDS REVIEW

- Default chosen: keep telemetry in Convex with bounded retention for the MVP;
  propose a dedicated time-series store only if measured volume exceeds Convex
  limits. No new technology is introduced without an approved
  `docs/technology-stack.md` change.
- Reversal: introduce a managed time-series store behind an adapter.

## D-008 Log retention periods (section 10.6) - NEEDS REVIEW

- Default chosen: 12 months for session and CGNAT logs, tenant-configurable. Do
  not enable deletion jobs until the owner confirms per-country periods.
- Reversal: retention window is tenant configuration.

## D-009 Pause eligibility (section 10.7) - NEEDS REVIEW

- Default chosen: no pause while the subscriber has overdue invoices unless the
  tenant explicitly allows it. Minimum and maximum length, pauses per year and
  the pause fee are tenant and package configuration.
- Reversal: pause rules screen (SET-09).

## D-010 Compensation default formula and caps (section 10.8) - NEEDS REVIEW

- Default chosen: credit = (verified downtime hours / 24) x daily package value;
  cap per outage = 7 days equivalent; cap per subscriber per month = 14 days
  equivalent; integer minor units; exclusions for planned maintenance, force
  majeure, abuse flags and duplicate compensation for the same outage.
- Reversal: compensation policy configuration (SET-09).

## D-011 Marketplace/courses data ownership (section 10.9) - NEEDS REVIEW

- Default chosen: catalog content owned by the platform catalog; tenant orders,
  enrollments and reviews are tenant-scoped. Document the interface before
  building MKT and CRS.
- Reversal: interface boundary is documented and configuration-driven.

## D-012 Audit log tenant fix and isolation - 2026-10-10

- Context: `logAudit` never writes `tenantId`; the tenant audit query filters on
  it and returns nothing. `analytics.ts`, `scheduledReports.ts` and
  `notifications.ts` are not tenant-filtered.
- Decision: fix foundations before feature work: write `tenantId` on
  tenant-scoped audit rows and scope every tenant read by the resolved tenant.
- Reversal: additive fields and filters; no destructive change.
