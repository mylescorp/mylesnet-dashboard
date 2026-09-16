# MylesNet web source map

`app/` is the Next.js-required App Router surface. It owns only URL entrypoints,
layouts, metadata, and API route handlers. It is deliberately not a home for
panel implementation.

| Folder | Owns |
| --- | --- |
| `landing/` | Landing components, content, legal and public-product UI; `routes/` holds public-page implementation |
| `captive-portal/` | Portal specification, ADR, templates, screens and future portal code |
| `dashboard/` | Tenant billing and subscriber-workspace implementation; `routes/` holds dashboard page implementation |
| `admin/` | Tenant administration implementation |
| `platform/` | MylesNet platform-control implementation; `routes/` holds platform page implementation |
| `reseller/` | Reseller implementation |
| `agency/` | Agency implementation |
| `partner/` | Partner implementation |
| `subscriber-portal/` | Subscriber self-service boundary |
| `shared/` | Cross-panel UI primitives, authentication, providers, hooks, design tokens and adapters |

Add business UI to its named folder first, then expose it through a small
`app/` route file. Do not create an `apps/web/features/` directory.
