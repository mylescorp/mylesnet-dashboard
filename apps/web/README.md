# apps/web

The MylesNet Next.js web application. See [PANELS.md](PANELS.md) for the
developer-facing ownership map.

The direct panel folders (`landing/`, `dashboard/`, `admin/`, `platform/`,
`reseller/`, `agency/`, `partner/`, `captive-portal/`, and
`subscriber-portal/`) own application implementation. `shared/` owns reusable
web-only UI, authentication, adapters, hooks, and design utilities.

`app/` is intentionally limited to the Next.js-required route entrypoints,
layouts, metadata files, and HTTP route façades. Do not put panel business UI
or content there.
