<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent Skills

This project has access to reusable agent skills from multiple sources:

### Local Skills (`C:\Users\Admin\.agents\skills\`)
Core opencode skills for code review, automation, subagents, loops, hooks, and more. Load via `/skill-name` when needed.

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

- `docs/technology-stack.md` is the fixed, authoritative technology contract for MylesNet (byte-identical mirror of the vault file `products/mylesnet/technology-stack.md`). Read it before any architecture or dependency decision, and check every proposed change against it.
- Do not add a new runtime package, service, provider, or infrastructure technology that is not listed there. A justified addition requires (1) a dated decision-log entry, (2) an update to **both** `docs/technology-stack.md` and the vault file, and (3) noting the change in the daily record. Until then it is drift, not an accepted change.
- Build work converges to the stack's monorepo shape (`apps/`, `convex/`, `services/`, `packages/`, `infrastructure/`) per the migration gates in `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md`. The current single Next.js app is the pre-migration state, not the target.
- Keep `docs/technology-stack.md` and `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md` identical to their vault sources; a divergence is drift.

## Captive portal (T-HOT)

- Canonical scope: `docs/captive-portal/captive-portal-specification.md` (byte-identical mirror of the vault `products/mylesnet/captive-portal-specification.md`); flows: `docs/captive-portal/captive-portal-flows.md`. Read these before any captive-portal/hotspot code.
- Built as a route surface in this app: screens/logic in `apps/web/captive-portal/`, thin stubs in `apps/web/app/(portal)/hotspot/**`, thin Convex adapters in `convex/portal/`, `@portal/*` alias, tenant resolved by hostname. Do not create a separate portal app.
- Schema additions (§18) stay centralized in `convex/schema.ts`; no new runtime dependency may be introduced without the Technology Stack (no drift) rule above. Build work has not started (spec approved 2026-09-10; implementation deferred by owner directive).

## Agent threads / transcripts

- `docs/agent-threads/` is the archival home for **notable** agent sessions — a byte-identical mirror of the vault `products/mylesnet/agent-threads/`. Check its `README.md` index at session start for recent context.
- One thread = one pair: `YYYY-MM-DD-<slug>.md` (verbatim transcript with a summary/decision block up top) + `YYYY-MM-DD-<slug>.json` (structured twin for querying).
- Archive only notable sessions (decisions, approvals, audits, investigations). Whenever one materially changes the product, record it here **and** copy both files identical into the vault `products/mylesnet/agent-threads/` (vault canonical); a divergence is drift.
