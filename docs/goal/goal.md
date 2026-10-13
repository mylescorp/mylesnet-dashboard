---
title: MylesNet Tenant Panel End-to-End Goal
status: active
date: 2026-10-10
---

# GOAL: MylesNet Tenant Panel, end to end

## Objective

Make the MylesNet tenant panel (ISP dashboard) satisfy the full feature list in
`docs/tenant-panel-feature-list.md` for P1, then P2, then P3: every feature
implemented against real data, tested, reviewed, merged to `main`, deployed to
production and verified live with a real ISP test tenant. Features that need an
external credential or paid account that has not been supplied ship fully built
but disabled behind tenant-level configuration, and are listed in
`docs/goal/blockers.md`. Nothing is faked.

## Measurable success criteria

- Feature count per phase with status Done, Disabled-pending-credentials, or
  Parked; P1 count of Done reported against the P1 total.
- All closeout checks green: tenant isolation suite, permission matrix per role,
  money-flow tests, accessibility and responsive checks, dependency audit,
  clean typecheck and lint.
- Production URL loads; a real sign-in works; each module's main flow works with
  a real test tenant; hosting and backend logs show no new errors.

Current reality (2026-10-10): the panel is a narrow billing workspace; most
features are Partial or Missing (see `docs/tenant-panel-audit.md`). Full
completion is a long-horizon program across many sessions. This file is the
durable contract and resume point.

## Superseding rules (this program only)

- Feature list rule 13 (wait after each module) is cancelled; report and
  continue.
- Feature list rule 10 review cap is replaced by the REVIEW GATE in the program
  brief.
- Section 10 open decisions are not waited on: pick the recommended default,
  record it in `decisions.md`, tag NEEDS REVIEW, keep it reversible through
  configuration.
- Repo root `AGENTS.md`, `docs/technology-stack.md`,
  `docs/no-technology-stack-exposure.md`, and the local vault `AGENTS.md` all
  still apply. Where `AGENTS.md` conflicts with the brief on safety, `AGENTS.md`
  wins and the conflict is reported in `progress.md`.

## Module order (from feature list section 9)

1. Foundation (XC): auth, sessions, roles, tenant isolation, audit log, design
   tokens, i18n scaffolding, loading/error/empty patterns.
2. ONB and SET.
3. SUB and PKG.
4. BIL, PAY (manual recording first), CMP rule scaffolding.
5. NET and OUT, then CMP automation on verified outages.
6. PAU, SES, VCH, AGT.
7. SUP, COM, LED, WRK, MAP.
8. IMP and CPL.
9. DSH and RPT with real aggregates.
10. P1 closeout (permissions, tenant isolation, load, accessibility).
11. P2: ACC, FIB, CPE, AST, AUT, SVY, LOY, ENT, MKT, CRS, HRM, API, NET extras.
12. P3: ADD, VEN, AIX, NET-19 and remaining items.

## Per-module checklist

- [ ] Branch `feat/<MODULE-ID>-<kebab-title>` off `origin/main` (worktree when
      the owner checkout is dirty).
- [ ] Backend first: validation, auth check, role check, tenant scope, audit
      log, idempotency for money.
- [ ] UI against the real backend: four states (loading, error with retry,
      empty with a real action, success), translation keys, light and dark,
      responsive.
- [ ] Tests: happy path, rejection, wrong role, wrong tenant, section 7 edge
      cases.
- [ ] Pre-PR self-check: typecheck, lint, tests, build, dependency audit; no
      console.log, no TODO/FIXME, no commented-out code, no mock/placeholder
      data, no hardcoded values, no `any`/ts-ignore, no em dashes, no stack or
      vendor names in user-facing copy.
- [ ] Commit with feature IDs; open PR with the repo template.
- [ ] Greptile REVIEW GATE to 5/5; fix root causes; never game the review.
- [ ] Merge to `main`; delete the branch.
- [ ] Deploy to production; verify.
- [ ] Update `docs/tenant-panel-audit.md`, `progress.md`, `decisions.md`,
      `blockers.md`, `lessons.md`, then vault records.

## Definition of done (per feature, section 11)

Backend with auth/role/tenant scope/validation; UI with four real states;
permission matrix row enforced server-side; audit log entries; tests for happy,
rejection, wrong role, wrong tenant and section 7 edges; no mock data, no
hardcoded values, no em dashes; light/dark, responsive, translation keys;
typecheck, lint, tests pass; committed and reviewed (Greptile 5/5 or reported
blockers); feature ID listed in the audit file as Done with evidence.

## Stop conditions

1. Goal achieved and verified.
2. Every remaining item is blocked by something only the owner can provide.
3. A live production security incident: fix or roll back immediately, record,
   then continue; stop only if it cannot be contained.

## Resume after interruption

1. Read this file, `docs/goal/progress.md`, `docs/goal/blockers.md`, and the
   vault goal (`products/mylesnet/goals/tenant-panel-program-2026-10-10.md`).
2. Find the first module in `progress.md` not marked complete.
3. Check branch and PR state: `git branch`, `git status`, `gh pr list`.
4. Continue the loop from the module's first unchecked item.
