# MylesNet local vault reference

This document records the owner-designated local reference location and the
required synchronization practice for current and future agents.

## Location on this workstation

The owner-designated MylesNet project/vault checkout is:

```text
/home/myles/Projects/mylescorp-brain/
```

This is the configured local vault containing MylesCorp Brain records. The
MylesNet source repository is a separate checkout at
`/home/myles/Projects/mylesnet-dashboard/`. This location is specific to this workstation;
it is not guaranteed to exist in another developer's machine, CI, or a hosted
agent environment.

Older notes that refer to `C:\Obsidian\MylesCorp-Brain` are historical. The
configured vault on this workstation is `/home/myles/Projects/mylescorp-brain/`.

## Required workflow

1. At the start of every meaningful MylesNet task, read this guide, root
   `README.md`, `AGENTS.md`, and the relevant source documents in the vault and
   repository. Check `docs/agent-threads/README.md` for notable prior work.
2. Inspect the vault checkout's current branch and `git status` before acting.
   It can contain owner/developer work that has not been committed. Preserve
   all existing changes. Do not reset, clean, stash, switch branches, or pull
   from that checkout while it is dirty.
3. For each meaningful implementation, audit, decision, release, or docs task,
   update the relevant vault record before closing the task. Record the date,
   scope, changed files or areas, verification performed, current status, and
   open work. Append a short entry to `docs/development/work-log.md` in both
   checkouts. For a product decision, update the decision log. For implementation
   status, update the relevant module/task register. For a notable agent session,
   update the transcript archive.
4. Keep documents declared as byte-identical mirrors byte-identical. The repo
   `docs/` copy is not silently authoritative when a document is explicitly
   vault-canonical. Compare after copying or editing.
5. Never add credentials, secret values, customer data, or sensitive provider
   responses to vault notes, source code, transcripts, or ordinary logs. Record
   secret variable names and approved storage locations only.
6. Before concluding, report whether the vault and repository documentation
   were both updated. If the path is unavailable or write permissions prevent
   synchronization, say exactly which record remains unsynchronized. Do not
   claim sync without checking it.

## Common record mapping

| Topic | Repository record | Vault checkout record |
| --- | --- | --- |
| Product decisions | `docs/decisions.md` | Corresponding MylesNet decision record in the local checkout |
| Technology contract | `docs/technology-stack.md` | MylesNet technology-stack record; keep byte-identical when declared a mirror |
| System architecture | `docs/architecture/` | Corresponding architecture/specification record |
| No-stack-exposure policy | `docs/no-technology-stack-exposure.md` | Corresponding MylesNet policy record |
| Captive portal requirements | `docs/captive-portal/` | Corresponding approved product specification and flow records |
| Platform module progress | `docs/development/platform-module-register-2026-10-01.md` | Current MylesNet module/task record |
| Meaningful agent work | `docs/development/work-log.md` | `/home/myles/Projects/mylescorp-brain/products/mylesnet/work-log.md` |
| Agent sessions | `docs/agent-threads/` | Matching project agent-thread record when a separate mirror exists |

The exact vault folder names can evolve. Search the checkout's `docs/` and
project indexes before adding a duplicate record. Prefer updating the existing
canonical page and its index.

## Access and safety

The vault checkout may contain ignored local configuration files. Never read
secret-bearing files just to discover what they contain. The documented path
does not grant permission to bypass filesystem protections; use an authorized
writable checkout or request access if the environment blocks an intended
update.
