# MylesNet repository map

## Ownership boundaries

| Area | Responsibility |
| --- | --- |
| `apps/web/landing` | Landing, legal, SEO, public resources, and conversion UI |
| `apps/web/{admin,platform,dashboard,reseller,agency,partner}` | The named panel implementation boundaries |
| `apps/web/app/(public)` and `apps/web/app/(panels)` | URL, metadata, layout, and thin route-entry boundaries only |
| `apps/web/captive-portal` | Deferred captive-portal boundary; route stubs live in `(portal)/hotspot` |
| `apps/admin` | Separate deployment for the platform control plane (`/platform`); mirrors the shipped platform route tree while `apps/web` still serves it |
| `convex` | Tenant authorization, billing workflows, WorkOS webhook, schema, and jobs |
| `packages` | Shared contracts only; no panel-specific implementation |
| `services` | Future private RADIUS, connector, and communications services |

## Navigation rules

- `apps/web` is the only current deployment of the tenant workspace, landing,
  and public surfaces. `apps/admin` is a separate deployment for the platform
  control plane (`/platform`). While both ship the panel, `apps/admin` mirrors
  the platform route tree and reads the panel and shared runtime from
  `apps/web/platform` and `apps/web/shared` through path aliases; the two
  deployments are held together by
  `scripts/audit/admin-platform-boundary.test.mjs`.
- A panel is a route/host and authorization boundary. `apps/admin` is that
  boundary for `/platform`; the planned `apps/network` boundary for the shared
  network-operation `/admin` surface is not built yet, and tenant `/admin`
  remains in `apps/web`.
- Tenant-owned records derive `tenantId` from authenticated membership, never
  browser input or `marketId`.
- New panel UI begins in `apps/web/<panel-or-domain>` and is composed
  by a thin route file.
- Do not restore retired collector, RouterOS, telemetry, HealthGuard, or
  Centipid code without a dated architecture decision and migration plan.
