# MylesNet Captive Portal — Architecture Decision Record

Supplement to `docs/captive-portal/captive-portal-specification.md` and the vault
decision log `products/mylesnet/decisions.md` (2026-09-10 entries). The decision
record below pins build-facing rulings; the spec remains the authority.

## 2026-09-10 — Single system, feature-slice folder (ADR-001)

- **Decision**: the captive portal is a route surface in the unified MylesNet
  system (one repo, one Next.js app, one Convex project). Screens live in this
  `apps/web/features/captive-portal/` folder and are mounted by thin
  `apps/web/app/(portal)/hotspot/**`
  stubs and `convex/portal/` adapters, resolved by tenant hostname.
- **Why**: no separate deployable; shared identity, billing, RADIUS, and tenant
  guards; resolves the old "`apps/portal` approval-gated do-not-create" open
  item from the v2 Gap Analysis.
- **Stack impact**: none — no new runtime package, service, or provider. The
  folder is an organizational structure; recorded to satisfy the technology-stack
  Drift Control rule.

## 2026-09-10 — Phase 6 auth order (ADR-002)

- **Decision**: the portal remains interface-only until an approved RADIUS or
  connector contract exists. It does not retain a direct RouterOS dependency.
- **Why**: billing and tenant isolation are the active product boundary; network
  access is introduced only through a separately approved, tenant-scoped contract.
