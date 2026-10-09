# MylesNet

MylesNet is a multi-tenant ISP operations and billing product built by MylesCorp
Technologies Ltd. It gives internet service providers a workspace for managing
subscribers, plans, vouchers, payments, markets, staff, and operational records.
MylesCorp staff use a separate platform control plane to manage tenants and
shared platform workflows.

This repository is the source for the web product and its Convex application
backend. Read this guide with [`AGENTS.md`](AGENTS.md), the product decisions,
and the local vault guidance in [`docs/vault-reference.md`](docs/vault-reference.md).

> **Product boundary:** The web application and Convex backend are the current
> deployed product surfaces. The RADIUS, network worker, communications, mobile,
> and infrastructure directories describe planned boundaries; they are not live
> services in this checkout. Do not describe the target architecture as already
> implemented or production-ready.

## Contents

- [Product surfaces](#product-surfaces)
- [Architecture and repository map](#architecture-and-repository-map)
- [Authentication and tenant security](#authentication-and-tenant-security)
- [Current scope and known limitations](#current-scope-and-known-limitations)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Development and verification commands](#development-and-verification-commands)
- [How to make changes safely](#how-to-make-changes-safely)
- [Deployment and production operations](#deployment-and-production-operations)
- [Documentation and the local vault](#documentation-and-the-local-vault)
- [Troubleshooting](#troubleshooting)
- [Ownership](#ownership)

## Product surfaces

One Next.js application serves several URL and authorization boundaries:

| Surface | Main implementation | Purpose |
| --- | --- | --- |
| Public site | `apps/web/landing/`, `apps/web/app/(public)/` | Product information, pricing, resources, legal pages, and contact/conversion flows |
| Platform | `apps/web/platform/`, `apps/web/app/(panels)/platform/` | MylesCorp tenant administration, access, billing/revenue, support, and platform operations |
| Tenant workspace | `apps/web/dashboard/`, `apps/web/app/(panels)/dashboard/` and related panel routes | ISP subscriber, plan, voucher, market, team, payment, expense, and reporting workflows |
| Admin | `apps/web/admin/`, `apps/web/app/(panels)/admin/` | Tenant administration workflows |
| Reseller, agency, partner | `apps/web/{reseller,agency,partner}/` | Delegated product surfaces, gated by configuration and authorization |
| Subscriber self-service | `apps/web/subscriber-portal/` | Reserved boundary; the intended `/dashboard/portal` route is future work, not a shipped self-service promise |
| Hotspot captive portal | `apps/web/captive-portal/`, `apps/web/app/(portal)/hotspot/` | Deferred product boundary and route stubs; implementation is not approved to start without the owner’s direction |

`apps/web/app/` contains Next.js route entry points, layouts, metadata, and HTTP
route handlers. Business UI and domain behavior belong in the named panel or
domain folder, with thin route files exposing that implementation.

The canonical panel inventory and historical status are in
[`apps/web/PANELS.md`](apps/web/PANELS.md) and
[`docs/development/platform-module-register-2026-10-01.md`](docs/development/platform-module-register-2026-10-01.md).
The module register is a dated working record, not proof that every row is
complete on the current branch. Confirm each route, role gate, backend handler,
test, and deployment state before reporting a module as shipped.

## Architecture and repository map

```text
apps/
  web/                  Current Next.js product: public site and product panels
  mobile/               Reserved for a post-pilot mobile application

convex/                 Current application backend: schema, functions, auth,
                        tenant controls, workflows, HTTP handlers, and crons

packages/
  ui/                   Shared UI primitives and tokens
  schemas/              Shared validation-schema package boundary
  api-contracts/        Shared API-contract package boundary
  config/               Shared configuration package boundary

services/
  network-worker/       Planned private Go network-control worker
  radius/               Planned FreeRADIUS configuration and fixtures
  communications/       Planned tenant SMS/email adapter boundary

infrastructure/         Planned Terraform, container, monitoring, and runbook boundary
docs/                   Product policy, architecture, decisions, and operating guides
```

The root workspace uses pnpm and Turborepo. `pnpm-workspace.yaml` includes
`apps/*`, `packages/*`, `services/*`, and `infrastructure/*`. The web application
is currently the only deployed application; a folder in the monorepo does not
imply that a service or separate deployment exists.

### Main code locations

| Location | Responsibility |
| --- | --- |
| `apps/web/app/` | Next.js App Router pages, layouts, metadata, proxy, and API entry points |
| `apps/web/shared/` | Shared authentication, navigation, UI, hooks, adapters, and user-safe error handling |
| `apps/web/landing/` | Public page content and components |
| `apps/web/dashboard/`, `apps/web/platform/`, `apps/web/admin/` | Tenant and platform product implementation |
| `apps/web/reseller/`, `apps/web/agency/`, `apps/web/partner/` | Delegated panel implementation |
| `apps/web/captive-portal/`, `apps/web/subscriber-portal/` | Subscriber-facing boundaries; check scope and implementation before extending |
| `convex/schema.ts` | Central Convex schema and indexes |
| `convex/lib/` | Authorization, tenant policy, validation, and reusable domain logic |
| `convex/*.ts` | Queries, mutations, actions, HTTP routes, and scheduled workflows |
| `convex/_generated/` | Convex-generated API/data model types; regenerate through the supported Convex workflow, do not hand-edit generated contracts |
| `packages/ui/` | Shared UI primitives and design tokens |
| `docs/technology-stack.md` | Approved technology contract; read before architecture or dependency changes |
| `docs/decisions.md` | Product and implementation decisions with historical context |
| `docs/no-technology-stack-exposure.md` | Required user-facing safety and copy rules |

More detailed maps: [`apps/web/PANELS.md`](apps/web/PANELS.md),
[`docs/architecture/repository-map.md`](docs/architecture/repository-map.md),
and [`docs/technology-stack.md`](docs/technology-stack.md).

## Authentication and tenant security

- WorkOS AuthKit is the workforce identity boundary for platform and ISP staff.
- The active WorkOS organization claim is mapped server-side to a tenant.
- Tenant records are scoped in Convex. A browser-supplied `tenantId`, `marketId`,
  route parameter, or filter is never authority to access a tenant’s records.
- Convex functions enforce authentication, active membership, role, permission,
  and tenant ownership. UI visibility is not an authorization control.
- Platform roles and tenant roles are separate. A platform permission must not
  silently substitute for a tenant permission, or vice versa.
- `apps/web/proxy.ts` provides an early routing/session boundary. Data access
  authorization remains enforced in Convex and server-side application code.
- The subscriber identity boundary is distinct from workforce identity. Follow
  the approved identity decision in `docs/technology-stack.md`; do not grant
  staff or router privileges through subscriber login.
- The shared safe error translation boundary is
  `apps/web/shared/lib/user-facing-error.ts`. User-visible errors must not expose
  raw exceptions, provider payloads, internal IDs, source paths, environment
  values, secrets, or implementation details.

Before changing UI, APIs, authentication, integrations, forms, notifications,
or error handling, read [`AGENTS.md`](AGENTS.md) and
[`docs/no-technology-stack-exposure.md`](docs/no-technology-stack-exposure.md).
For tenant authorization changes, inspect the matching Convex handler and add
tests for both allowed access and cross-tenant denial.

## Current scope and known limitations

- The production web application is hosted on Vercel; Convex is a separate
  backend deployment and release boundary.
- A successful Vercel build or deployment does not prove that Convex functions,
  schema, WorkOS configuration, third-party callbacks, or network integrations
  are healthy.
- `services/` and `infrastructure/` are planned skeletons without live service
  implementations or applied infrastructure in this repository snapshot.
- `apps/mobile/` is reserved; do not start it without measured pilot need and a
  dated product/architecture decision.
- Captive portal work is deferred. Keep its current route/module boundaries and
  follow the approval instructions in `AGENTS.md` before implementation.
- Several platform modules are partial or absent. Use the current module register
  and inspect the actual code/test/deployment evidence before making a completeness
  claim.
- Public usage-pricing figures and currency conversions are indicative. Written
  commercial terms govern; see `/pricing`, `docs/decisions.md`, and the accepted
  customer quote/order.
- Old references to Collector, direct RouterOS monitoring, HealthGuard, or
  Centipid in historic notes may describe retired work. The retirement boundary
  is documented in [`docs/architecture/legacy-retirement.md`](docs/architecture/legacy-retirement.md).

## Getting started

### Prerequisites

- Node.js 24 or later (`package.json` declares `node >=24`).
- Corepack with pnpm 10.33.0, as pinned by the package manifests.
- Git and network access to the configured package registry.
- Development WorkOS and Convex configuration to use authenticated product
  flows. Public pages can often be developed without provider credentials, but
  do not claim that authenticated workflows were verified without them.

### Install and run the web app

From the repository root:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open <http://localhost:3000>. The root `dev` script starts the web app on port
3000. For HTTPS-dependent identity-provider testing, see
[`docs/development/local-https.md`](docs/development/local-https.md); HTTP is the
normal local development mode.

### Start a development Convex deployment

Configure a development deployment using the local environment instructions in
[`docs/production-deployment.md`](docs/production-deployment.md) and
`convex.json`, then run:

```bash
corepack pnpm exec convex dev
```

Use only a development deployment for local development. Never point a local
schema/function change at production unless the owner approved the exact target
and the production release gate is complete.

## Environment configuration

`.env.example` is the repository’s variable-name inventory. It is not a source
of live credentials. Web development reads the environment for the `apps/web`
Next.js project; Convex CLI configuration is also needed when running Convex
commands from the repository root. Use ignored local environment files and put
only development credentials in them.

Common configuration groups include:

| Group | Examples of variable names | Use |
| --- | --- | --- |
| Convex | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT` | Web connection and local Convex deployment selection |
| WorkOS | `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_WEBHOOK_SECRET`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Workforce sign-in, session protection, and webhook verification |
| Product routing | `MYLESNET_PUBLIC_DOMAIN`, `MYLESNET_COOKIE_DOMAIN`, `MYLESNET_PLATFORM_ORG_ID` | Product host/cookie behavior and platform organization mapping |
| Public site | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_COMPANY_*` | Canonical metadata and public contact details |
| Feature/access controls | `NEXT_PUBLIC_ENABLE_*`, `NEXT_PUBLIC_RBAC_*` | Explicitly gated panel and authorization rollout behavior |

See `.env.example` for the full names and comments. Do not paste or commit values
from `.env.local`, `.env.deploy`, `.env.production`, `.aws`, `.vercel`, or `.convex`.
Never print secrets into logs, transcripts, documentation, tickets, or screenshots.
Production credentials belong in the approved secret store and the explicitly
approved deployment environment file only.

## Development and verification commands

Commands run from the repository root unless noted:

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Start Next.js development server on port 3000 |
| `corepack pnpm lint` | Lint the web application |
| `corepack pnpm typecheck` | Run the web TypeScript check |
| `corepack pnpm test` | Run Convex/library Node tests and shared web tests |
| `corepack pnpm test:ui` | Run the web Jest suite |
| `corepack pnpm tokens:check` | Enforce design-token and raw-colour rules |
| `corepack pnpm landing:check` | Verify public landing route contracts |
| `corepack pnpm build` | Build the Next.js application for production |
| `corepack pnpm exec convex dev` | Start the configured development Convex workflow |

The CI quality job installs the frozen lockfile and runs lint, typecheck,
design-token checks, Convex/library tests, UI tests, and a production build. The
CI security job runs secret scanning and dependency auditing, with filesystem
scanning when container files exist; CodeQL runs separately. Run the affected
tests while iterating, then run the full relevant gate before proposing a merge.
Do not describe a check as passing unless it actually ran and passed.

## How to make changes safely

1. Read this README, `AGENTS.md`, and the task-relevant documents under `docs/`.
   At session start, also read `docs/agent-threads/README.md` for notable
   archived context.
2. Check `git status --short --branch` and preserve all existing changes. Never
   reset, clean, stash, or overwrite another developer’s work without explicit
   authorization.
3. Check the local vault instructions in
   [`docs/vault-reference.md`](docs/vault-reference.md). Reference and update
   the vault for every meaningful project task, including decisions, shipped
   behavior, verification, and remaining work.
4. Before a new dependency, provider, service, or infrastructure decision, read
   `docs/technology-stack.md`. Do not introduce technology drift. Record an
   approved change in the dated decision log and synchronize canonical mirrors.
5. Keep panel business logic in its named folder. Keep route entry files thin.
   Keep Convex schema changes in `convex/schema.ts`; use generated types rather
   than editing generated contracts manually.
6. Derive tenant scope from authenticated identity and active membership. Never
   trust a client-provided tenant identifier. Add allowed-path and denial-path
   coverage for authorization changes.
7. Use the shared business-language error boundary. Do not expose stack traces,
   paths, provider names, raw IDs, endpoints, credentials, or implementation
   details in product UI.
8. Update the documentation and status register when behavior or rollout status
   changes. Clearly label code that is partial, unverified, local-only, or not
   deployed.
9. Run the relevant checks and `git diff --check`. Report exact checks and
   blockers in the PR description.

Use the repository PR workflow for shared changes. Vercel Preview is the web
review artifact; it does not deploy Convex functions or schema.

## Deployment and production operations

The release has two independent deploys:

1. Deploy the approved Convex schema/functions to the exact approved production
   deployment.
2. Deploy the web commit to the configured Vercel project and verify it points
   to the intended Convex URL.

Follow [`docs/production-deployment.md`](docs/production-deployment.md) for the
release gate, target confirmation, order, rollback, and minimum post-deploy
checks. Never infer a production Convex deployment from a successful Vercel
deployment. Never deploy to an unidentified Convex target or print the deploy
key.

## Documentation and the local vault

The owner-designated local project/vault checkout on this workstation is
`/home/myles/Projects/mylesnet-dashboard/`. It contains the project’s source and
vault-style documentation; the repo-side mirrors live under `docs/`. This local
path is machine-specific and may not exist in CI or another developer’s
environment. Read [`docs/vault-reference.md`](docs/vault-reference.md) for the
mandatory reference and update procedure, portability rules, and secret-handling
limits.

Important documents:

- `docs/decisions.md` — dated decisions and implementation history.
- `docs/technology-stack.md` — approved technology contract.
- `docs/architecture/` — system and repository boundaries.
- `docs/development/platform-module-register-2026-10-01.md` — platform scope and
  dated implementation evidence.
- `docs/production-deployment.md` — deployment and production-verification gate.
- `docs/development/work-log.md` — short dated record of meaningful agent work.
- `docs/agent-threads/` — notable decision/audit/investigation archive.
- `apps/web/PANELS.md` — ownership map for web implementation folders.

Do not add secrets to vault notes. Keep canonical mirrored documents byte-for-
byte synchronized when their source changes, and record when the local vault
could not be updated. If the local vault path is unavailable, say so clearly;
never imply that it was checked or synchronized.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `pnpm` command unavailable | Enable Corepack and verify Node 24+ and the pinned pnpm version. |
| Authenticated pages fail locally | Confirm the development WorkOS configuration, redirect URI, cookies, and Convex development URL; do not switch to production credentials. |
| Convex says no deployment is configured | Select/configure a development Convex deployment; do not guess a production deployment name. |
| Design-token check cannot find app folders | Run the root script through `pnpm tokens:check`; it expects the web app working directory. |
| Route smoke check differs | Run `pnpm landing:check` and compare to `apps/web/app/(public)/`. |
| Vercel Preview passes but data/API is unavailable | Check the matching Convex deployment and environment separately; the frontend and backend deploy independently. |
| A local build/test fails before changed code runs | Capture the exact command/error and distinguish checkout/dependency problems from source failures; verify in clean CI before calling it a regression. |

## Ownership

Product owner: **@mylesoft**
