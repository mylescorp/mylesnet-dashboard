# Agent threads / transcripts

Archived **notable** agent sessions for MylesNet. One thread = one pair: a dated
`YYYY-MM-DD-<slug>.md` (verbatim transcript + summary/decisions up top) and its
`YYYY-MM-DD-<slug>.json` twin (structured, queryable).

Canonical local vault checkout on this workstation:
`/home/myles/Projects/mylesnet-dashboard/docs/agent-threads/`.
Repository mirror: `docs/agent-threads/` in the active worktree. Keep matching
thread `.md` and `.json` files byte-identical in both checkouts; a divergence
is drift. For the access and safe-update procedure, see
[`../vault-reference.md`](../vault-reference.md).

## Index

| Date | Slug | Topic | Agent | Status |
|---|---|---|---|---|
| 2026-09-12 | [transcript-archive-setup](2026-09-12-transcript-archive-setup.md) | Establish agent-thread archive (vault + repo mirror) | opencode (`big-pickle`) | recorded |
| 2026-09-15 | [l2-audit-hash-chain-closeout](2026-09-15-l2-audit-hash-chain-closeout.md) | L2 audit hash chain close-out (Option C): full-chain verification, decision record, thread archive | opencode (`big-pickle`) | recorded |

## Rules

- Archival is for **notable** sessions only: decisions, approvals, audits,
  investigations. Routine work-in-progress sessions are not archived.
- Full verbatim transcript goes in the `.md` with outcome, decisions, files
  touched, and open questions as a summary block up top.
- Mirror every change byte-identical between vault and repo (vault canonical).
- English only; no secrets, credentials, or provider IDs in these files.
