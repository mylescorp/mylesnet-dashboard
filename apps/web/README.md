# apps/web

The MylesNet Next.js web application. See [PANELS.md](PANELS.md) for the
developer-facing ownership map.

For repository setup, environment handling, verification, security boundaries,
and release steps, start with the root [README](../../README.md) and
[AGENTS.md](../../AGENTS.md). For the owner-designated local project/vault
checkout and the required synchronization workflow, read
[`docs/vault-reference.md`](../../docs/vault-reference.md).

The direct panel folders (`landing/`, `dashboard/`, `admin/`, `platform/`,
`reseller/`, `agency/`, `partner/`, `captive-portal/`, and
`subscriber-portal/`) own application implementation. `shared/` owns reusable
web-only UI, authentication, adapters, hooks, and design utilities.

`app/` is intentionally limited to the Next.js-required route entrypoints,
layouts, metadata files, and HTTP route façades. Do not put panel business UI
or content there.
