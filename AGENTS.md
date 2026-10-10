<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Greptile PR Gate (MANDATORY, NO EXCEPTIONS)

Applies to every feature, bug fix, refactor, docs, or config change. Linear is not used: no issue IDs in branches, commits, or PRs.

1. Never work on main. Branch format: [type]/[kebab-case-title], for example feat/tenant-onboarding. If the owner checkout has uncommitted changes, work in an isolated git worktree. Never reset, clean, stash, or discard pre-existing work.
2. Stage only your own changes by explicit path. Never use git add . or git add -A where pre-existing dirty files exist. Your worktree must end with a clean git status. The owner's dirty files stay untouched and uncommitted unless Myles says otherwise. The regenerated nextjs-agent-rules block may be committed with your work.
3. Pre-PR self-check: run typecheck, lint, tests, and build and fix every failure. Search your diff for console.log, TODO or FIXME, commented-out code, mock or placeholder or sample data, hardcoded values, secrets, and technology-stack, provider, or path leakage in user-facing strings (docs/no-technology-stack-exposure.md). Fix everything before pushing. If typecheck, lint, test, or build failures reproduce identically on a clean checkout of main and are outside your diff, they do not block opening the PR. List them in the PR body under 'Known baseline failures'. Never fix unrelated code inside a gate or config PR; propose a separate PR instead.
4. Commit with a clear conventional message, push, and open a PR using the PR template. Never put secret values, env values, or provider responses in commits, PR bodies, or review replies.
5. Wait for the Greptile review. Read its confidence score from its review summary on the PR (gh pr view <number> --comments or gh api). Do not end the session while the review is pending.
6. Read every Greptile comment. Fix each valid issue, commit, push, and wait for the re-review. If a comment is wrong, reply on the PR with the technical reason.
7. Repeat step 6 until Greptile gives 5/5.
8. Anti-gaming: never reach 5/5 by editing .greptile config, lint rules, CI config, or tests to silence a finding. Never resolve a thread without a fix or a reasoned reply. Never shrink or split the diff just to dodge review. Never merge below 5/5. Exception: findings about the correctness of the .greptile config itself may be fixed in the PR that introduces it, with a reasoned reply on the thread.
9. Stop conditions: after 5 review rounds, or when the same finding returns 3 times, or when Greptile does not respond after a reasonable wait, stop work on that PR and report the PR URL, current score, and blocking comments to Myles. Continue other safe work on separate branches.
10. Before requesting the final review, commit the PR note, index row, lessons, work-log entry, and production-plan update when applicable, including the score and findings from the preceding review round. Keep these records synchronized in the repo and vault. The final Greptile summary on the final commit is the canonical evidence of its 5/5 score; do not create another record-only commit after that confirmation. Merge only after that exact commit has Greptile 5/5, CI passes, and branch protection passes. 5/5 is a required merge gate and not completion of the production program; the release criteria above still apply. If a vault write is blocked, say exactly what was not synchronized. The Greptile gate still stands.


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

- `docs/technology-stack.md` is the fixed, authoritative technology contract for MylesNet (byte-identical mirror of `/home/myles/Projects/mylescorp-brain/products/mylesnet/technology-stack.md`). Read it before any architecture or dependency decision, and check every proposed change against it.
- Do not add a new runtime package, service, provider, or infrastructure technology that is not listed there. A justified addition requires (1) a dated decision-log entry, (2) an update to **both** `docs/technology-stack.md` and the vault file, and (3) noting the change in the daily record. Until then it is drift, not an accepted change.
- Build work converges to the stack's monorepo shape (`apps/`, `convex/`, `services/`, `packages/`, `infrastructure/`) per the migration gates in `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md`. The current single Next.js app is the pre-migration state, not the target.
- Keep `docs/technology-stack.md` and `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md` identical to `/home/myles/Projects/mylescorp-brain/products/mylesnet/technology-stack.md` and `/home/myles/Projects/mylescorp-brain/products/mylesnet/Reports/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md`; a divergence is drift.

## No technology stack exposure

- Read `docs/no-technology-stack-exposure.md` before changing any UI, API response, authentication, integration, error boundary, loading state, form, notification, or panel route.
- All user-facing failures must use the shared safe error translation boundary. Never render raw exceptions, provider responses, stack traces, source paths, endpoint URLs, environment values, internal IDs, or implementation names.
- This is a release requirement for every panel. Validate failure paths and visible copy before claiming a change is complete.

## Captive portal (T-HOT)

- Canonical scope: `docs/captive-portal/captive-portal-specification.md` (byte-identical mirror of `/home/myles/Projects/mylescorp-brain/products/mylesnet/captive-portal-specification.md`); flows: `/home/myles/Projects/mylescorp-brain/products/mylesnet/design/captive-portal-flows.md` mirrored to `docs/captive-portal/captive-portal-flows.md`. Read these before any captive-portal/hotspot code.
- Built as a route surface in this app: screens/logic in `apps/web/captive-portal/`, thin stubs in `apps/web/app/(portal)/hotspot/**`, thin Convex adapters in `convex/portal/`, `@portal/*` alias, tenant resolved by hostname. Do not create a separate portal app.
- Schema additions (§18) stay centralized in `convex/schema.ts`; no new runtime dependency may be introduced without the Technology Stack (no drift) rule above. Build work has not started (spec approved 2026-09-10; implementation deferred by owner directive).

## Agent threads / transcripts

- `docs/agent-threads/` is the archival home for **notable** agent sessions — a byte-identical mirror of `/home/myles/Projects/mylescorp-brain/products/mylesnet/agent-threads/`. Check its `README.md` index at session start for recent context.
- One thread = one pair: `YYYY-MM-DD-<slug>.md` (verbatim transcript with a summary/decision block up top) + `YYYY-MM-DD-<slug>.json` (structured twin for querying).
- Archive only notable sessions (decisions, approvals, audits, investigations). Whenever one materially changes the product, record it here **and** copy both files identical into the vault `products/mylesnet/agent-threads/` (vault canonical); a divergence is drift.


## Local Vault Reference (Required)

- Configured vault: `/home/myles/Projects/mylescorp-brain/`. Read `docs/vault-reference.md` at the start of meaningful MylesNet work.
- Repo work log: `docs/development/work-log.md`; vault copy: `/home/myles/Projects/mylescorp-brain/products/mylesnet/work-log.md`. Keep the records synchronized.
- Greptile review results are logged under `products/mylesnet/greptile-review/` in the vault and in `docs/development/work-log.md`.
- Do not inspect or print `.env*`, `.aws`, `.vercel`, `.convex`, or other secret-store values. Preserve vault edits and never initialize a Git repository in the vault.
