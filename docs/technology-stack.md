---
type: reference
status: active
date: 2026-09-09
tags: [mylesnet, technology-stack, current]
---

# MylesNet Full Production Technology Stack

> [!INFO] **CANONICAL TECHNOLOGY CONTRACT** - Fixes the chosen technologies for MylesNet. Relationship to the [[MylesNet_Master_Technical_Specification_v3|MylesNet Master Technical Specification - Version 3 Final]]: the Master defines requirements, architecture, and boundaries (AAA in Part A, v3 additions in Part B, including §B16 production stack); this file governs **which** technologies are in use and how they are operated, and refines the Master where choices had not yet been pinned. Repository mirror, kept byte-identical: `docs/technology-stack.md` in `mylesnet-dashboard`.

# MylesNet Full Production Technology Stack
## Architecture Summary

MylesNet will be a pnpm/Turborepo monorepo: Vercel hosts the web product; Convex provides tenant-aware SaaS workflows and real-time UI state; AWS Cape Town hosts the private AAA, network, data, queue, security, and observability plane. The system is sized and load-tested initially for 10,000 concurrent sessions, with a 99.95% target, RPO of 15 minutes, and RTO of four hours.

## Selected Stack

| Layer | Selected technology |
|---|---|
| Monorepo | pnpm, Turborepo, TypeScript |
| Web | Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, React Hook Form, Zod, TanStack Table, ECharts |
| Product hosting | Vercel |
| Public edge | Cloudflare DNS, wildcard tenant subdomains, WAF, DDoS protection, rate limits |
| SaaS backend | Convex queries, mutations, actions, HTTP routes, crons, subscriptions, and database |
| Workforce identity | WorkOS/AuthKit for MylesCorp staff, tenant administrators, SSO, organization membership, and MFA |
| Subscriber identity | Auth0 with phone-OTP-first sign-in and password fallback; tenant-selected SMS providers through a validated communications adapter. Auth0 supports SMS passwordless connections and custom phone-provider configuration. [Auth0 SMS OTP](https://auth0.com/docs/authenticate/passwordless/authentication-methods/sms-otp) |
| AAA | FreeRADIUS 3.x, active-active containers, PPPoE and MikroTik Hotspot first |
| Network automation | Go services for RouterOS API, SNMP, SSH, provisioning, CoA/Disconnect, backups, and telemetry |
| Private runtime | AWS ECS Fargate in a private VPC |
| Transactional SaaS data | Convex: tenants, memberships, subscribers, services, invoices, entitlement workflow, support, UI read models |
| AAA and ledger data | Amazon RDS PostgreSQL Multi-AZ: RADIUS policy replicas, sessions, accounting, quotas, payment postings, and financial ledger |
| Cache and ephemeral state | Amazon ElastiCache Redis: OTP state, rate limits, locks, deduplication, and short-lived authorization cache |
| Durable jobs | Amazon SQS, EventBridge, dead-letter queues, retry policies |
| File storage | Convex Storage for ordinary attachments; Amazon S3 for backups, exports, KYC archives, router backups, and long-lived invoices |
| Secrets and encryption | AWS Secrets Manager, KMS, Vercel/Convex/WorkOS secret stores; no secrets in application tables |
| Payments | Safaricom Daraja adapter first; tenant-owned and MylesCorp-managed collection models; future adapters through the same contract |
| Communications | Tenant-selected SMS/email providers behind a provider adapter; OTP, payment, expiry, suspension, and reconnection templates |
| Monitoring | OpenTelemetry, CloudWatch, AWS Managed Prometheus/Grafana, Sentry |
| CI/CD and IaC | GitHub, GitHub Actions, Terraform, Docker, Dependabot/CodeQL/secret and container scanning |
| Deferred | Expo apps, PostGIS/MapLibre, TimescaleDB, ClickHouse, Temporal, advanced multi-vendor automation, GIS, and AI |

## Data, Identity, and Network Boundaries

- Every tenant-owned record carries `tenantId`; Convex guards, PostgreSQL row-level security, SQS job envelopes, S3 prefixes, NAS clients, payment credentials, and communications settings all enforce the same tenant boundary.
- Each ISP receives a WorkOS organization for workforce access. Subscribers are separate Auth0 identities and never acquire staff/network privileges from portal authentication.
- Configure Auth0 as a Convex OIDC provider with an exact issuer and audience; do not use an unsigned or audience-free custom token integration. [Convex OIDC guidance](https://docs.convex.dev/auth/advanced/custom-auth)
- Convex emits signed, idempotent provisioning jobs; only private Go workers may access routers or RADIUS secrets. Workers report verified results, while Convex updates real-time product state.
- FreeRADIUS authenticates locally from PostgreSQL policy replicas and cache so subscriber access does not depend on Convex or Vercel availability. RadSec is preferred; tightly restricted UDP RADIUS is allowed only through approved private VPN connectivity.
- Payment activation follows: verified callback → idempotency/reconciliation → PostgreSQL ledger posting → entitlement update → SQS provisioning job → RADIUS policy update → CoA/Disconnect → session verification → notification.

## Monorepo Shape

```text
apps/
  web/                 Next.js admin, reseller, subscriber, and public web portals
  mobile/              Reserved for post-pilot Expo applications

convex/
  tenants/ auth/ subscribers/ billing/ entitlements/
  network/ tickets/ notifications/ http/ crons/

services/
  network-worker/      Go device and RADIUS-control worker
  radius/              FreeRADIUS configuration, modules, test fixtures
  communications/      Tenant-provider SMS/email adapter gateway

packages/
  ui/ schemas/ api-contracts/ config/

infrastructure/
  terraform/ docker/ monitoring/ runbooks/
```

## Deployment and Acceptance Plan

1. Build the tenant, WorkOS, Auth0, subdomain, permission, audit, and migration foundations; migrate the current dashboard estate into the MylesNet tenant with reconciliation.
2. Provision AWS VPC, ECS Fargate, RDS Multi-AZ, Redis, SQS/EventBridge, S3, Secrets Manager, Cloudflare, monitoring, backup, and disaster-recovery infrastructure through Terraform.
3. Deploy and validate the two-node FreeRADIUS plane, PostgreSQL policy replication, Go worker, RadSec/VPN NAS connectivity, MikroTik PPPoE/Hotspot, accounting, CoA, and Disconnect.
4. Deliver Daraja reconciliation, entitlement lifecycle automation, tenant communication adapters, and subscriber web portal.
5. Require cross-tenant denial tests, payment duplicate/reversal tests, RADIUS failover and stale-accounting tests, backup-restore proof, RPO/RTO recovery drill, and a 10,000-session load test before general availability.

## Assumptions

- AWS Cape Town is the primary region; disaster-recovery replication is disclosed to tenants and follows the selected RPO/RTO.
- SaaS subscription invoices remain manually issued and emailed initially; subscriber M-Pesa automation is a separate system.
- Maps, mobile apps, TimescaleDB, ClickHouse, Temporal, and AI are intentionally deferred until the AAA/billing pilot produces measured need.

---

# Production Hardening Notes

Working notes that make each layer production-grade. Expand a section (with evidence) before a layer goes live; keep this file the single technology contract.

## Monorepo and tooling

- pnpm with a single lockfile; `packageManager` pinned via `package.json` so CI and local builds share one resolution. Never mix npm/yarn lockfiles.
- Turborepo for build/task caching; cache keys include env vars, lockfile, and generated package contracts so stale outputs cannot ship.
- TypeScript strict everywhere; shared schemas live in `packages/schemas`, shared contracts in `packages/api-contracts`, so the API layer cannot silently diverge from the UI.
- Version discipline: pin runtime dependencies exactly (or by lockfile); upgrade via the change procedure in the Drift Control section below.
- Do not add a package not on this stack; if a gap is real, record it in this file first (see Drift Control).

## Web and multi-portal delivery

- One Next.js app (`apps/web`) serves Platform, Admin, Dashboard (incl. subscriber portal), and Reseller through route/panel scoping, not multiple deployments. Multi-tenant hostname resolution is explicit at the edge (wildcard tenant subdomains) and validated server-side.
- shadcn/ui + Radix UI primitives for accessible UI; React Hook Form + Zod for validated forms; TanStack Table for data grids; ECharts for telemetry and billing charts (loaded as needed to keep bundles lean). shadcn foundation packages: clsx, tailwind-merge, class-variance-authority (2026-09-12 landing-surface design contract). Radix primitives: @radix-ui/react-dialog, @radix-ui/react-select, @radix-ui/react-slot, @radix-ui/react-sheet (2026-09-12 landing-surface Phase 2).
- Tailwind for styling with the approved `--*` design-token contract, enforced by `tokens:check`. Components must not hardcode palette values.
- Panels follow the canonical naming map (Platform/Admin/Dashboard/Reseller; Agency/Partner gated) in the Master Part C §C1.

## Public edge and tenant subdomains

- Cloudflare is the only public ingress: DNS, WAF, DDoS mitigation, rate limiting, and TLS termination; tenant subdomains use a wildcard and per-tenant zone overrides where needed.
- Vercel remains the web host behind Cloudflare; tighten the origin so only Cloudflare or approved health checks reach it.
- Rate limits are per subscriber identity or IP, keyed by `tenantId` for tenant-level controls, and recorded in the authorization cache.
- Enable proxy header trust so `x-forwarded-for`/`x-forwarded-proto` cannot be spoofed by clients.

## Convex SaaS backend — tenant-aware workflows

- Convex is the transactional SaaS control plane: tenants, memberships, subscribers, services, invoices, entitlements, support, and UI read models. It is not authoritative for AAA, accounting, or RADIUS sessions.
- Every tenant-owned document carries `tenantId` as the first field; every query and mutation derives the tenant from the session (WorkOS org claim), never from client input. Add a tenant-guard wrapper to schema tables and enforce it in code review.
- Auth0 is joined as a Convex OIDC provider with exact issuer and audience (Convex custom-auth guidance); access tokens are validated by Convex, and subscriber sessions are scoped to the subscriber domain only (no staff/org claims).
- Long-running or external work (callbacks, provisioning, communications, RADIUS actions) goes through Convex `action`s/HTTP routes that emit signed, idempotent jobs; never block a front-end request on network-plane latency.
- Crons handle reconciliation (stale sessions, unposted callbacks, expiring entitlements) and are themselves idempotent.
- Real-time state (session lists, telemetry, ticket boards, payment activity) uses Convex subscriptions; heavy telemetry at the 10,000-session scale stays in the observability plane, not the UI database.

## Workforce identity — WorkOS/AuthKit

- WorkOS/AuthKit is the only workforce identity. Scopes: Platform org (MylesCorp staff), Network org (network operations), and one WorkOS org per tenant (tenant administrators). SSO and MFA set by organization policy; session TTL tiered by panel scope (per Master Part B §B15).
- Role and membership mirrors in Convex are derived from WorkOS and stay synchronized; WorkOS is authoritative for who can belong, Convex for what they may do inside a panel.
- No subscriber identity ever gains a staff/network claim from portal authentication.

## Subscriber identity — Auth0

- Auth0 handles subscriber identity only: phone-OTP-first via Auth0 SMS passwordless, password fallback for users who set one. OTP delivery uses the tenant-selected SMS provider through the validated communications adapter.
- Never federate subscriber identity into WorkOS orgs or grant router/RADIUS/staff privileges through portal login.
- Enforce account enumeration protection, rate-limit OTP attempts, and rotate/expire OTP state via Auth0 settings plus the Redis OTP cache.
- **Supersession note (2026-09-09, [[Jonathan Myles]] stack directive):** this entry supersedes the Master Final Part B §B4 line "The previous Auth0 subscriber-portal concept is rejected." Subscriber identity is Auth0; staff/network identity remains WorkOS-only. Record the same annotation in the Master at approval time so the two documents do not silently conflict.

## AAA plane — FreeRADIUS

- FreeRADIUS 3.x runs active-active (two-node) containers on ECS Fargate; `radmin`/status-server health gates the load balancer so a degraded node drains, not dies mid-session.
- Authentication and authorization read from PostgreSQL policy replicas (clients/NAS, users, groups, quotas, package policies); subscription to Live Redirect: locally cached policy + Redis for hot checks, never depending on Convex or Vercel to answer a RADIUS request.
- Transport: RadSec (RADIUS over TLS) preferred for NAS connectivity; tightly restricted UDP RADIUS (shared-secret per NAS, source-IP locked) allowed only through approved private VPN connectivity. Any UDP RADIUS exposure dials up at edge firewall level, never on the public internet.
- CoA/Disconnect uses `Dynamically Authorized` packets; the Go worker signs and sends CoA/Disconnect, then verifies the NAS/appliance state and the live session before declaration of success.
- Stale accounting: reconcile interim/dropped Stop records periodically; prevent orphaned sessions from consuming quota forever.
- Add only tested dictionaries/attributes; keep a committed test fixture set (RADIUS request → expected response) in `services/radius` and run it in CI before AAA releases.

## Network automation — Go workers

- One Go service shape (`services/network-worker`) covers RouterOS API, SNMP, SSH, provisioning, CoA/Disconnect, backups, and telemetry polling. Concurrency-bounded, single binary, no shell-outs to network tools.
- Workers are the only actors with router/RADIUS secrets; they pull credentials from Secrets Manager at startup (and on rotation), never from configuration files.
- Every job is idempotent: the worker upserts status by job id and reports verified results; Convex reads results to update the real-time product state, so a retried job cannot double-provision.
- Least-privilege IAM: the worker task role can reach only the queues it consumes, the buckets it owns, and the IP ranges it must manage; all other egress is blocked.

## Private runtime and network topology

- ECS Fargate inside a private VPC; no public IPs on tasks. A NAT gateway (or managed egress) is the only outbound path; inbound is via the load balancer and managed endpoints.
- Security groups are least privilege at interface level; the data plane (RADIUS/RadSec), the control plane (worker ↔ routers), and the SaaS plane (Fargate ↔ RDS/Redis/SQS) are isolated and cross-accessed only through defined rules.
- Router/NAS reachability is scoped: the worker can reach each NAS from a dedicated source range so a NAS cannot pivot into unrelated AWS services.

## Data layer — PostgreSQL, RLS, and the ledger

- Amazon RDS PostgreSQL Multi-AZ holds: RADIUS policy replicas, sessions, accounting, quotas, payment postings, and the financial ledger. Convex is *not* the system of record for these.
- **Row-level security (RLS)** is the tenant boundary at the database: every financial/AAA table gets a generated `tenant_id` column, RLS policies scoped to the reading role, and a `SET app.tenant_id` requirement before any tenant-scoped query. Test cross-tenant denial with the acceptance suite.
- Ledger invariant: every posting is an insert-only row (event sourcing for money); no in-place updates to posted amounts; reversals are new rows referencing the original id. Idempotency keys make double-application impossible.
- Quotas and balances are derived, not stored twice; aggressive caching of session/radius reads goes through Redis, writes stay transactional in PostgreSQL.

## Cache and ephemeral state — Redis

- ElastiCache Redis for: OTP state (short-lived, TTLed), rate-limit counters, distributed locks (provisioning, reconciliation), job deduplication keys, and short-lived authorization cache.
- Every key is namespaced by `tenantId` where tenant-owned; auth/OTP keys are never shared across tenants by index.
- Use atomic ops (INCR, SETNX/`SET NX PX`, EXPIRE) so counters and locks stay correct under concurrency; never read-then-write without atomicity.
- Redis is not a system of record; a Redis loss must be absorbed by PostgreSQL/Convex recovery, not cause a billing or session-state contradiction.

## Durable jobs — SQS, EventBridge, DLQs

- SQS (and EventBridge schedules for crons) is the durable queue between Convex/workers and the AWS plane. Exactly-once delivery is not promised by SQS, so consumers are idempotent by design (job id key + Redis dedupe).
- A dead-letter queue per critical queue, alarm on DLQ depth, and a replay/repair script for poison messages.
- Job envelopes carry `tenantId`, `jobId`, attempts, and schema version so every stage enforces the same boundary and can safely replay.

## File storage

- Convex Storage for ordinary attachments; Amazon S3 (tenant-prefixed) for backups, exports, KYC archives, router backups, and long-lived invoices.
- S3 bucket policies and prefixes enforce tenant boundaries; lifecycle rules move old backups/archives to cheaper tiers; versioning and object-lock protect audit-required files.

## Secrets and encryption

- Secrets in AWS Secrets Manager and KMS, plus the Vercel/Convex/WorkOS secret stores; **no secrets in application tables or vault notes**. Vault notes record key *names*, not values.
- KMS envelope encryption for RDS (TDE plus app-layer where required), S3 (SSE-KMS), and Redis (encryption in transit and at rest).
- Rotation: router/API credentials and DB passwords rotate on schedule; workers refresh credentials from Secrets Manager on rotation without restart where possible.
- Credential handling in code: retrieve at runtime, never log, mask in telemetry.

## Payments — Safaricom Daraja

- Daraja adapter first with tenant-owned and MylesCorp-managed collection models. STK Push, B2C/status, and reconciliation flows behind one idempotent adapter contract.
- Every callback is validated (signature/order checks), deduplicated by M-Pesa transaction id, then posted through the idempotency/reconciliation path in the Data and Identity boundaries section.
- Reversals and disputes are separate posting rows; the ledger records the complete lifecycle. Do not treat a silent callback gap as success — reconciliation crons pull Daraja status for pending transactions.
- Future providers (e.g., Airtel Money) join through the same adapter contract; they are approval-gated and never change the payment activation sequence.

## Communications adapters

- Tenant-selected SMS/email providers sit behind one adapter (`services/communications`), with a validated provider per tenant. OTP, payment, expiry, suspension, and reconnection templates per tenant.
- Providers are supplier-agnostic: swapping a provider must not change the call path or tenant data model; provider credentials are tenant-scoped secrets.
- Delivery is queued (SQS) and retried with backoff; delivery status is recorded for audit, not assumed.

## Observability

- OpenTelemetry everywhere: the Go worker, FreeRADIUS (status/metrics), PostgreSQL, Redis, and the Next.js/Convex path emit traces, metrics, and logs with consistent resource attributes (`service.name`, `tenantId`, `layer`).
- CloudWatch is the operational sink; AWS Managed Prometheus/Grafana gives alerting dashboards; Sentry captures front-end/back-end errors with tenant context redacted from error payloads.
- Per-layer SLOs map to the 99.95% availability target and the stated RPO (15 minutes) / RTO (four hours); runbook drills prove recovery, and the load test asserts 10,000 concurrent sessions with headroom.

## CI/CD, IaC, and supply-chain security

- GitHub + Actions as the pipeline; Terraform for all AWS/Cloudflare infrastructure (state in a remote backend with locking and audit); Docker for reproducible worker/radius images (multi-arch, minimal base, `distroless`-style where practical); Dependabot, CodeQL, secret scanning, and container scanning in CI.
- Branch protection on main; infra changes require plan review; environment gates (`dev` → `staging` → `prod`) run the acceptance suite at each step.
- Docker images are immutable and referenced by digest; supply-chain pinning (pnpm `verify-store-integrity`, Image lock) prevents drift between CI and prod.
- Terraform modules live in `infrastructure/terraform`; every change is reviewed and applied through the pipeline, never by hand.

## Deferred technologies and reopening criteria

- Deferred: Expo mobile apps, PostGIS/MapLibre, TimescaleDB, ClickHouse, Temporal, advanced multi-vendor automation, GIS, and AI.
- Reopen a deferred item only with measured need from the AAA/billing pilot (documented call volume/scale evidence), a recorded decision in `decisions.md`, and an update to this file.

---

# Drift Control — Daily Agenda Rule

This is the mechanism that stops technology drift.

- The technology stack is read at the start of every MylesNet session, along with the other product files (see [[AGENTS]] work rules). It is the benchmark for every dependency, service, provider, and infrastructure decision made that day.
- [[No Technology Stack Exposure Standards]] and [[no-tech-stack-exposure|MylesNet No Technology Stack Exposure]] are also mandatory at session start. Every user-facing change must preserve the safe error, business-language, and identifier rules before it can be considered complete.
- A change to a technology, a version policy, or a new addition is allowed only through this file: **add/update the stack entry here first (with a date and reason), mirror it to `docs/technology-stack.md`, and record the decision in `decisions.md`.** Until that happens it is drift, not an accepted change.
- Suspicion of drift (a dependency, provider, or pattern not represented here or in the Master) is reported in the daily note and task lane; the resolution is either (a) record it here, or (b) remove/revert it. The stack file and the repo copy must not diverge.
- The Master Technical Specification and this stack are kept consistent: a requirement change lands in one place and is reflected in the other (this file for *which* technology; the Master for *how it must behave*).
- The stack file is reviewed whenever a milestone checkpoint passes, and its "Production Hardening Notes" are expanded with evidence before each layer goes live.

## Related

- [[MylesNet_Master_Technical_Specification_v3|MylesNet Master Technical Specification - Version 3 Final]] — requirements, architecture, boundaries, and acceptance.
- [[codebase]] — current repository state and build commands.
- [[no-tech-stack-exposure|MylesNet No Technology Stack Exposure]] — mandatory safe user-facing error and stack-secrecy policy.
- Repository mirror: `docs/technology-stack.md` (kept byte-identical to this file).

## Owner

[[Jonathan Myles]]
