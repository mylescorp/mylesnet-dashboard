---
type: agent-thread
date: 2026-09-12
agent: opencode
model: big-pickle
product: mylesnet
status: recorded
tags: [mylesnet, agent-thread, transcript, archive, convention]
---

# 2026-09-12 — Establish agent-thread archive (vault + repo mirror)

## Outcome

Established the convention and directories for archiving **notable** agent
sessions (transcripts) in both the vault (`products/mylesnet/agent-threads/`)
and the repo (`docs/agent-threads/`) as byte-identical mirrors. This session is
the seed entry.

## Decisions made

- **Location:** project-scoped mirror — vault `products/mylesnet/agent-threads/`
  ↔ repo `docs/agent-threads/` (vault canonical), following the existing
  byte-identical mirror convention.
- **Formats:** each thread stored as a `.md` (readable transcript) **and** a
  `.json` structured twin for querying. One thread = one pair.
- **Content:** verbatim transcript with outcome, decisions, files touched, and
  open questions as a summary block up top.
- **Indexing:** dated files `YYYY-MM-DD-<slug>.md` / `.json` plus a `README.md`
  index (date · slug · topic · agent · status).
- **Coverage:** **notable** sessions only — decisions, approvals, audits,
  investigations. Routine sessions are not archived.
- **Discovery:** both root `AGENTS.md` files updated so the convention stays in
  agent context (vault `products/mylesnet/AGENTS.md` and repo `AGENTS.md`).
- **Mirror sync:** manual copy on each change; a divergence between vault and
  repo is drift.

## Files touched

- Vault `products/mylesnet/AGENTS.md` (folder map, work rules, verification).
- Repo `AGENTS.md` (new "Agent threads / transcripts" section).
- Vault `products/mylesnet/agent-threads/README.md`, seed `.md` + `.json`.
- Repo `docs/agent-threads/README.md`, seed `.md` + `.json` (byte-identical).

## Open questions / blockers

- None recorded.

## Transcript

### User

Asked for a place in both the vault and the repo to add transcripts / agent
threads "just like this one", stored as text markdown and JSON files; asked to
use the question tool to discuss the design.

### Discussion (question tool)

Chosen design: project-scoped mirror · markdown + JSON · verbatim transcript
with summary up top · dated files + README index · notable sessions only.

### Assistant

Confirmed the vault location (`products/mylesnet/agent-threads/`) and repo
mirror (`docs/agent-threads/`), the `.md` / `.json` file-pair convention, the
README index, and the AGENTS.md documentation.

### User

Directed that both root AGENTS.md files — the one in the vault MylesNet
directory and the repo root — be updated to reflect this convention so it is
always available in agent context.

### Assistant

Read both AGENTS.md files and produced a finalized plan covering the vault
AGENTS.md edits (folder map, work rules, verification), the repo AGENTS.md
section, the archive folders + README index, and the seed thread.

### User

Execute.