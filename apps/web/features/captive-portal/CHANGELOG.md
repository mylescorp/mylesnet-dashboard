# MylesNet Captive Portal — Changelog

Scaffold only (no code). No functional changes yet.

## 2026-09-10 — 0.1.0-scaffold

- Created `captive-portal/` feature-slice scaffold: `core/`, `ui/screens/`,
  `ui/components/`, `templates/`, `i18n/`, `config/`, `api/`, `terms/`, `test/`,
  plus `README.md`, `ADR.md`.
- Mirrored canonical spec + user flows into `docs/captive-portal/`.
- Spec was `draft - pending approval` at scaffold time; build work had not started.

## 2026-09-10 — spec approved

- [[Jonathan Myles]] approved the captive portal specification; implementation is
  explicitly deferred ("will be done later"). No build work starts until directed.
  Approval recorded in the spec Document Control, repo `docs/captive-portal/` mirror,
  repo `AGENTS.md`, and this changelog.

## 2026-09-16 — feature relocation and legacy reset

- Moved the canonical feature scaffold to `apps/web/features/captive-portal/`.
- Reserved `apps/web/app/(portal)/hotspot/**` for thin route stubs only.
- Retired the legacy RouterOS/collector dependency; future access integration is
  approval-gated behind a tenant-scoped RADIUS or connector contract.
