# MylesNet

MylesNet is a multi-tenant ISP billing and subscriber-operations SaaS for
MylesCorp Technologies Ltd. One deployed web application serves the public
site, platform control plane, tenant billing workspace, subscriber portal, and
delegated reseller surfaces.

## Repository map

```text
apps/mobile/                  Reserved mobile application
apps/web/                     Next.js web product and landing site
convex/                       Tenant-aware workflow backend and WorkOS webhook
packages/                     Shared UI, schemas, API contracts, and configuration
services/                     Future private RADIUS, connector, and communications boundaries
infrastructure/               Infrastructure and operational runbooks
docs/                         Product documentation and vault mirrors
```

Product decisions are maintained in `docs/decisions.md`; the vault holds the
canonical long-term record and is reconciled separately when decisions change.
All user-facing work must follow
[`docs/no-technology-stack-exposure.md`](docs/no-technology-stack-exposure.md).

The captive portal is a deferred web boundary at
`apps/web/captive-portal/`. Its future routes are mounted under
`apps/web/app/(portal)/hotspot/`; it is not a separate deployment.

## Local development

1. Copy `.env.example` to an untracked local environment file and supply the
   required WorkOS and Convex values.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Run `pnpm dev` and open `http://localhost:3000`.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:ui`,
`pnpm tokens:check`, and `pnpm build` before merging.

## Legacy retirement

The local collector, RouterOS monitoring suite, telemetry/HealthGuard paths,
and Centipid integration were retired from this repository. Their one-time data
export and production deletion are separate operational gates; see
`docs/architecture/legacy-retirement.md`.
