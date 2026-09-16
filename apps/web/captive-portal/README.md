# MylesNet Captive Portal — feature slice (scaffold)

This folder is the **organizational feature slice** for the MylesNet captive
portal, module **T-HOT**. Its canonical repository location is
`apps/web/captive-portal/`; it is not a separate app and adds no runtime
dependency — it is a repository structure only.

Authoritative specification: `docs/captive-portal/captive-portal-specification.md`
(byte-identical mirror of the vault `products/mylesnet/captive-portal-specification.md`).
Read it before any code in this folder.

## Mount contract

- Portal screens: `apps/web/captive-portal/ui/**` — thin route stubs in `apps/web/app/(portal)/hotspot/**`.
- Business logic: `apps/web/captive-portal/core/**` — thin Convex adapters in `convex/portal/**`.
- Schema additions: centralized in `convex/schema.ts` (spec §18 tables).
- Path alias: `@portal/*` → `apps/web/captive-portal/*`.
- Tenant resolution: by hostname, server-side, at the portal entry route.
- OS detection probes: `/hotspot-detect.html`, `/generate_204`, NCSI (spec §2).

## Status

Scaffold only — **no build work started** (spec **approved 2026-09-10**; implementation
deferred by owner directive).

## Folder map

- `core/` — types, canonical state machine (`payment_confirmed / provisioning /
  connected / reconnection_failed`), auth methods, trial engine, payment intents,
  session/device logic.
- `ui/screens/` — portal screens (login, welcome-back, register, trial, plans,
  pay, account, devices, usage, support, feedback).
- `ui/components/` — portal components, splash, thank-you/queued views.
- `templates/` — brand templates (colors, logo, background, font, language).
- `i18n/` — EN / SW / LU bundles.
- `config/` — provider adapters, plans/themes/splash/analytics/terms config.
- `api/` — Typed API contracts for portal client → Convex call surfaces.
- `terms/` — terms/privacy versions (referenced by `termsAcceptances`, not copies).
- `test/` — flow, state-machine, fraud, and accessibility tests.

History: `CHANGELOG.md`; rationale: `ADR.md`.
