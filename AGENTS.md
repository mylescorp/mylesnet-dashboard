<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Owner-priority objective: MylesNet platform to production

This is a persistent owner directive across agents and sessions. At the start of each MylesNet task, inspect this objective and its progress record before choosing other MylesNet work. Resume the production program and keep it the top MylesNet priority until the release acceptance criteria below are met, unless the owner explicitly redirects, pauses, or cancels it. Do not treat a plan, partial implementation, green local build, or preview deployment as completion.

Canonical progress record: `docs/development/platform-panel-production-plan.md`. Update it with completed phases, evidence, blockers, and the next concrete task at the end of each meaningful implementation session. Preserve all pre-existing dirty work; never reset, clean, or discard it. Use an isolated writable worktree for implementation when the owner checkout is dirty.

### Production objective and fixed decisions

Deliver the platform control plane in a separately deployable `apps/admin` app, preserving shipped `/platform` paths. Establish the planned `apps/network` boundary for `/admin`; do not remove legacy app surfaces before the no-deletion audit. Complete all 46 in-scope modules from the owner matrix; C2 remains excluded. Use the real `PLATFORM_SUB_ROLE_MAP`; every spec-silent role cell is denied. C4 uses tenant-owned gateway credentials, with finance restricted to non-secret updates. OPS O1 updates are restricted to approved storage/network-related fields. E4 route is `/platform/referrals`; I3 route is `/platform/feedback`, both with minimal auditable workflows. Require mandatory MFA for every platform role, 30-minute inactivity timeout, warning at 25 minutes, and 12-hour absolute session lifetime.

### Required delivery phases

1. Re-baseline the current branch, review and preserve all dirty changes, reconcile module counts/statuses and decisions, and complete the separate no-deletion audit.
2. Build the app boundaries and shared role-aware navigation, route gates, Convex authorization, session/MFA enforcement, safe errors, and audit controls.
3. Complete every in-scope module and its real payment, communications, provisioning, telemetry, and RADIUS integration against approved sandbox contracts and production services.
4. Prove every role/verb cell, tenant isolation, direct-route denial, secret handling, audit trail, session behavior, accessibility, light/dark UI, failure recovery, scale, and migration safety.
5. Pass repository CI/security gates; deploy to verified non-production targets, exercise recovery/rollback, then release the matching Convex and web apps to approved production targets with monitoring and operational handoff.

Production is complete only when all in-scope modules are accepted, no known critical/high authorization/security findings remain, required tests and gates pass on the release commit, integrations and monitoring are verified in production, rollback/recovery evidence exists, and the owner-approved release record is current. Never invent deployment targets or access/print secret values; stop only the affected deployment step when required credentials, contracts, or owner approvals are unavailable, and continue other safe work.


## Agent Skills

This project has access to reusable agent skills from multiple sources:

### Local Skills

On the MylesNet workstation, check `/home/myles/.codex/skills/` and the
available Codex plugin skills. In a repository-only environment, check
`.agents/skills/` and the initialized `vendor/davidondrej-skills/skills/`
submodule. These locations vary by environment; do not rely on the historical
Windows path `C:\Users\Admin\.agents\skills\`. If no applicable skill is
available, proceed using the repository instructions.

### David Ondrej Skills (`vendor/davidondrej-skills/skills/`)
Additional agent skills for orchestration, research, thinking, ops, and skill authoring. Reference the `SKILL.md` in each subfolder before use:
- `agent-orchestration/` - subagents, goal loops, handoffs, git worktrees
- `research-and-web/` - web/YouTube research (DeepAPI powered)
- `thinking-and-docs/` - structured thinking, documentation
- `ops-and-setup/` - server/security setup
- `skill-authoring/` - create/publish new skills

### Pre-Task Check
Before starting any coding task, check available skills in `.agents/skills/` and `vendor/davidondrej-skills/skills/`. Use the most relevant skill for the task.

## Technology Stack (no drift)

- `docs/technology-stack.md` is the fixed, authoritative technology contract for MylesNet (byte-identical mirror of `/home/myles/Projects/mylesnet-dashboard/docs/technology-stack.md` on this workstation). Read it before any architecture or dependency decision, and check every proposed change against it.
- Do not add a new runtime package, service, provider, or infrastructure technology that is not listed there. A justified addition requires (1) a dated decision-log entry, (2) an update to **both** the repo copy and the local vault copy, and (3) noting the change in the project status record. Until then it is drift, not an accepted change.
- Build work converges to the stack's monorepo shape (`apps/`, `convex/`, `services/`, `packages/`, `infrastructure/`) per the migration gates in `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md`. The current single Next.js app is the pre-migration state, not the target.
- Keep `docs/technology-stack.md` and `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md` identical to their corresponding local-vault sources; a divergence is drift.

## Local Vault Reference (Required)

- The owner-designated project/vault checkout on this workstation is
  `/home/myles/Projects/mylesnet-dashboard/`. Read
  [`docs/vault-reference.md`](docs/vault-reference.md) at the start of every
  meaningful MylesNet task.
- The local vault is machine-specific and may contain ignored environment or
  credential files. Read only the files relevant to the task. Never inspect,
  print, copy, or commit values from `.env*`, `.aws`, `.vercel`, `.convex`, or
  other secret stores.
- Check `git status` before working in the vault checkout. Preserve every
  pre-existing edit; do not reset, clean, stash, switch branches, or pull there
  while the tree is dirty. Use a separate writable worktree for isolated repo
  changes when necessary.
- Reference the vault before making decisions or documenting implementation.
  For each meaningful project task, append a short entry to
  `docs/development/work-log.md` and keep its vault copy synchronized. Also
  update the relevant vault status, decision, or module record with what
  changed, evidence/checks, and remaining work. Keep canonical repo mirrors
  synchronized with their vault sources.
- If access or filesystem permissions prevent a vault update, continue safe
  work in the repository, state exactly what was not synchronized, and do not
  claim that the repo and vault are in sync. Never bypass the environment's
  filesystem permissions.
- The older `C:\Obsidian\MylesCorp-Brain` paths in some historic notes are not
  the configured location on this workstation. The local configured path is
  recorded in `docs/vault-reference.md`; if it is absent in another
  environment, report that and use the tracked repository docs as the available
  source until the owner provides a replacement.

## No technology stack exposure

- Read `docs/no-technology-stack-exposure.md` before changing any UI, API response, authentication, integration, error boundary, loading state, form, notification, or panel route.
- All user-facing failures must use the shared safe error translation boundary. Never render raw exceptions, provider responses, stack traces, source paths, endpoint URLs, environment values, internal IDs, or implementation names.
- This is a release requirement for every panel. Validate failure paths and visible copy before claiming a change is complete.

## Captive portal (T-HOT)

- Canonical scope: `docs/captive-portal/captive-portal-specification.md` (byte-identical mirror of `/home/myles/Projects/mylesnet-dashboard/docs/captive-portal/captive-portal-specification.md` on this workstation); flows: `docs/captive-portal/captive-portal-flows.md`. Read these before any captive-portal/hotspot code.
- Built as a route surface in this app: screens/logic in `apps/web/captive-portal/`, thin stubs in `apps/web/app/(portal)/hotspot/**`, thin Convex adapters in `convex/portal/`, `@portal/*` alias, tenant resolved by hostname. Do not create a separate portal app.
- Schema additions (§18) stay centralized in `convex/schema.ts`; no new runtime dependency may be introduced without the Technology Stack (no drift) rule above. Build work has not started (spec approved 2026-09-10; implementation deferred by owner directive).

## Agent threads / transcripts

- `docs/agent-threads/` is the archival home for **notable** agent sessions — keep matching records byte-identical with `/home/myles/Projects/mylesnet-dashboard/docs/agent-threads/` on this workstation. Check its `README.md` index at session start for recent context.
- One thread = one pair: `YYYY-MM-DD-<slug>.md` (verbatim transcript with a summary/decision block up top) + `YYYY-MM-DD-<slug>.json` (structured twin for querying).
- Archive only notable sessions (decisions, approvals, audits, investigations). Whenever one materially changes the product, record it here **and** copy both files identically into the local vault checkout; a divergence is drift.
