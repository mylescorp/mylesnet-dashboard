# MylesNet agent work log

Use this file for short, dated entries describing meaningful agent work. Keep
the same file byte-identical in the owner-designated local vault checkout at
`/home/myles/Projects/mylesnet-dashboard/docs/development/work-log.md`.

Each entry should state the request/scope, what changed, what was checked, and
what remains. Link to the detailed decision, module register, or operational
record when one exists. Do not include secrets, customer data, or a full routine
transcript here; use `docs/agent-threads/` only for notable sessions under its
separate archive policy.

## Entries

### 2026-10-08 — Project README, vault reference, and release-guide refresh

- **Scope:** Analyze the MylesNet source tree and owner-designated local vault
  checkout; give future developers a practical setup, architecture, security,
  verification, and release guide.
- **Changes:** Expand root README; point root/web agent guidance to the local
  vault and require a work-log entry plus relevant canonical record for
  meaningful tasks; document vault path/portability/safety; align production
  deployment steps with actual pnpm/CI workflows; replace historic Windows-only
  vault references in the active no-stack and agent-thread guidance.
- **Evidence checked:** Repository instructions, root/web README and panel map,
  stack and architecture records, production deployment guide, module register,
  public/panel route layout, Convex source layout, package/service boundary
  READMEs, workflow scripts, and the local vault checkout's branch/working-tree
  status. No secret-bearing environment files were read.
- **Verification:** `git diff --check` and local Markdown link-target checks
  passed for the documentation changes. After CI surfaced the existing
  Next.js advisory, `pnpm audit --prod --audit-level=high` passed locally with
  the 16.3.8 patch. Automated tests/build were not run locally; CI must verify
  them on the updated PR.
- **Status:** The documentation set is synchronized into the owner-designated
  local vault checkout. The initial PR preview passed; CI's production audit
  found the pre-existing Next.js pin was below the security-patched release.
  Next.js and `eslint-config-next` are now pinned at 16.3.8 with a regenerated
  lockfile; CI and preview need to pass on the updated commit before merge.

## 2026-10-10: restore newer platform features

Prepared the reviewed platform feature bundle on `feat/restore-platform-features`, preserving the existing dirty production worktree. Restored platform analytics and leaderboard, API key management, payment reconciliation and anomaly review, commissions and payouts, agency/reseller lifecycle, RADIUS fleet, and the platform organization API. Reconciled schemas with current-main security and tenant lifecycle fields and corrected C5 reconciliation type errors. Web typecheck, backend typecheck excluding tests, 37 repository tests, and focused frontend lint passed. Build remains blocked by dependencies linked from outside this isolated clone. GitHub authentication is invalid, so no PR has been pushed or opened. The PR note will be linked after the PR is opened.
