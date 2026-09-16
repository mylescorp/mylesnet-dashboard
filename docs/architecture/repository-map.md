# MylesNet repository map

## Ownership boundaries

| Area | Responsibility |
| --- | --- |
| `apps/web/features/landing` | Landing, legal, SEO, public resources, and conversion UI |
| `apps/web/features/{admin,platform,dashboard,reseller,agency,partner}` | The named panel implementation boundaries |
| `apps/web/app/(public)` and `apps/web/app/(panels)` | URL, metadata, layout, and thin route-entry boundaries only |
| `apps/web/features/captive-portal` | Deferred captive-portal feature slice; route stubs live in `(portal)/hotspot` |
| `convex` | Tenant authorization, billing workflows, WorkOS webhook, schema, and jobs |
| `packages` | Shared contracts only; no panel-specific implementation |
| `services` | Future private RADIUS, connector, and communications services |

## Navigation rules

- `apps/web` is the only current web deployment. A panel is a route/host and
  authorization boundary, not another application.
- Tenant-owned records derive `tenantId` from authenticated membership, never
  browser input or `marketId`.
- New panel UI begins in `apps/web/features/<panel-or-domain>` and is composed
  by a thin route file.
- Do not restore retired collector, RouterOS, telemetry, HealthGuard, or
  Centipid code without a dated architecture decision and migration plan.
