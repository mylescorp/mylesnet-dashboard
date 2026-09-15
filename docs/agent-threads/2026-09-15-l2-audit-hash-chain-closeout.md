---
type: agent-thread
date: 2026-09-15
agent: opencode
model: big-pickle
product: mylesnet
status: recorded
tags: [mylesnet, audit, hash-chain, L2, close-out, decision]
---

# 2026-09-15 — L2 audit hash chain close-out (Option C)

## Outcome

Closed out the L2 audit hash chain under the owner's Option (c) directive:
the chain ships as **new chain from deployment** (no historical backfill),
verification now covers the **entire post-deployment sealed chain** from the
genesis sentinel forward (complete, not windowed), the decision is recorded in
`decisions.md`, and this session is archived. Full gate green
(typecheck 0 · lint 0 · tokens:check green · tests 154/154 · build green).
PR #17 holds for personal review — no self-merge.

## Decisions made

- **Option (c) — new chain from deployment.** The chain starts at the first
  post-deployment audit row (genesis sentinel `mylesnet:audit-chain:v1:genesis`);
  pre-deployment `auditLog` rows remain readable but are intentionally unsealed
  and outside the chain. No backfill is built.
- **No-backfill rationale (recorded in decisions.md):** a hash computed now
  cannot prove pre-backfill rows were unmodified before hashing, so backfilling
  offers no stronger real-world integrity guarantee; it would also put rewrite
  tooling inside an append-only log.
- **Verification must be complete, not windowed.** The previous 2000-row
  window is not a permanent ceiling.
- **Verification architecture:** background sweep (`convex/auditChainVerify.ts`)
  advancing one bounded 500-row batch per internal mutation, resumable via one
  canonical `migrationRuns` row (`audit-chain-verify-001`), hourly cron re-ran
  from genesis so coverage rolls over the whole sealed chain.
  `platform:getAuditChainHealth` only reads the run's stored status/coverage;
  the Audit log UI shows when the last full sweep completed and the exact chain
  range (sequence + time span) it covered.
- **Chain semantics unchanged:** sealing, canonical payload, and
  `chainSequence` behavior remain as approved (146/146 baseline + 8 new cases).
- **Hold for personal review:** PR #17 (`myles/platform-audit-hash-chain` →
  main) is not self-merged.

## Files touched

- `convex/lib/auditChainVerifyCore.ts` (new pure state machine) + its
  `auditChainVerifyCore.test.ts` (8 node:test cases).
- `convex/auditChainVerify.ts` (new sweep driver, internal mutation).
- `convex/platform.ts` (`getAuditChainHealth` rewritten as a run-status read).
- `convex/crons.ts` (hourly audit-chain integrity sweep).
- `convex/_generated/api.d.ts` (surgical module entry for the pinned generated
  api — no regeneration).
- `apps/web/lib/convex/platformPanel.ts` (bridge type updated).
- `apps/web/app/components/PlatformAuditLog.tsx` (integrity panel shows
  full-coverage sweep status + last completion + range).
- `decisions.md` (explicit L2 close-out decision, 2026-09-15).
- `docs/agent-threads/` + vault `products/mylesnet/agent-threads/` (this entry,
  byte-identical mirror created for both seed and this thread).

## Open questions / blockers

- None. Follow-up: manual `npx convex run` of the sweep in the live
  environment to verify the production chain end-to-end before merge.

## Transcript

### User

Laid out the L2 close-out as **Option (c)**: keep the new-chain-from-deployment
design; do **not** build a historical backfill migration; fix the verification
scope so it covers the entire post-deployment sealed chain (every row with a
non-null `hash`/`chainSequence`, from the genesis sentinel forward — complete,
not just the newest 2000); update `decisions.md` with an explicit decision
(date, PR number, rationale); archive the agent thread; then re-run the full
gate and report. Hold the PR for personal review; do not self-merge.

### Assistant

Reconciled state: another agent's L2 implementation was already committed
(`410da55`, PR #17) — sealing core in `convex/lib/auditChainCore.ts`, central
writer `convex/lib/auditLog.ts`, full UI + bridge, all direct inserts
re-pointed, 146/146 tests green, working tree clean. Recon read `crons.ts`,
the migration-run infra, scheduler-chaining patterns, the pinned `_generated`
api, and decisions.md L2 mentions. Designed and implemented the close-out:
pure resumable verification state machine (+8 tests covering genesis
enforcement, sequence gaps, missing links, tampered payloads, legacy skipping,
and cross-batch resume linking), an internal-mutation sweep driver with
paginated 500-row batches chained via `ctx.scheduler.runAfter(0, ...)`, an
hourly cron, a rewritten status-only `getAuditChainHealth`, bridge + UI update,
and a surgical `_generated/api.d.ts` entry (no regeneration).

### User

"proced" — proceed.

### Assistant

Executed: wrote the sweep + core + tests, wired the cron, replaced the windowed
query, updated the bridge and Audit log integrity panel, fixed decisions.md
line endings (region LF-only, no BOM, minimal diff +40/-0), created the
agent-thread archive pair in `docs/agent-threads/` and mirrored the folder
byte-identical to the vault. Ran the full gate: typecheck 0, lint 0,
tokens:check green, tests 154/154, production build green. Reported; the PR is
held for personal review (no self-merge).