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
  passed. Automated tests/build were not run because this task changes
  documentation only.
- **Status:** The documentation set is synchronized into the owner-designated
  local vault checkout. The GitHub PR and its CI/preview checks remain to be
  completed.
