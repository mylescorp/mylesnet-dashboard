# Platform panel production plan

**Status:** implementation roadmap, based on the repository state reviewed 2026-10-01.  
**Scope:** `/platform`, the MylesCorp control plane. Shared network operations stay in `/admin`; tenant ISP operations stay in `/dashboard`.


## Owner-approved implementation progress — 2026-10-08

The production objective and fixed owner decisions are recorded in root `AGENTS.md`. Implementation is ongoing in isolated branch `codex/platform-production` at `/home/myles/Work/mylesnet-production`; the dirty owner checkout is preserved. C2 remains excluded. The approved boundary split, 46 in-scope module completion, approved live integrations, production configuration/deployment, and release acceptance are not complete.

Implemented and locally verified in the isolated worktree: mandatory MFA on mapped platform roles; 12-hour absolute lifetime and Convex-backed 30-minute idle session enforcement with a minute-25 warning, server revocation, role-fingerprint invalidation, and bounded expiry pruning; exact mapped-role gates for platform reads; corrections for J3 SA/RO, payout/report SA/FIN, broadcasts SA/SUP, and J1 SA/OPS/FIN/RO access; tenant snapshot checks for workspace, market ownership, and membership; and the platform-admin alias correction in user-directory controls. Build does not establish live provider readiness.

Checks on 2026-10-08: `pnpm typecheck` passed; `pnpm test` passed 36 test files; UI Jest passed 1 suite / 12 tests; `pnpm tokens:check` passed; lint has zero errors and one existing warning; webpack production build exited 0 and generated 167 routes using a non-secret placeholder Convex URL. `pnpm audit --prod --audit-level=high` could not reach npm due registry DNS `EAI_AGAIN`. The full production audit, app split, remaining modules/integrations, production provider targets, deployment, monitoring, recovery drill, and release approval remain outstanding. See the isolated worktree copy of this plan and its current module register for detailed progress.

## Current baseline

The panel already has tenant provisioning and lifecycle controls, tenant detail and membership visibility, plan entitlements, platform access management, paginated audit history with hash-chain health, security and webhook summaries, feature flags, a voucher anomaly monitor, and initial device fleet/provisioning surfaces. These are implemented in the existing single Next.js app with Convex functions. They are not all deployment-ready: several functions and schema additions still require an explicit Convex deployment-boundary sync, and the checkout is 11 commits behind `origin/main` with local changes present.

All access management is consolidated on `/platform/access`. Authorized administrators receive the existing full users/roles/invitations UI; users with read-only platform access receive the scoped summary. `/access` remains a compatibility redirect only.

The subscription screen manages entitlements only. It does not issue SaaS invoices or record subscription payments. Tenant SaaS invoice handling is explicitly excluded as C2. The approved billing scope here is the C1 platform revenue dashboard; its MRR/ARR data source must be reconciled to the actual subscription/plan model before reporting is built. Support impersonation, platform API keys, and data requests remain gated by prerequisites.

## Delivery sequence

### 0. Release boundary and authorization correctness

- Keep every page behind `requirePanelAccess("platform")` and every Convex read/write behind its own platform role or permission check.
- Make action visibility match backend capabilities. The tenant lifecycle and entitlement mutations permit `platform_owner`, `platform_admin`, and `ops_manager`; the UI must expose those actions to the same roles and hide them from read-only/support roles.
- Reconcile the MFA policy before production: `docs/auth/README.md` and the September 13 decision call privileged MFA mandatory, while current `convex/lib/mfa.ts` and tests make it optional for every role. Do not silently choose a policy in the UI.
- Validate the exact WorkOS organization, Convex deployment, webhook configuration, and environment before syncing new backend functions. Keep generated API bindings pinned until the target is verified.

**Exit criteria:** role matrix is documented and enforced on server and UI; unauthenticated, wrong-role, inactive-user, and unconfigured-backend states are checked; MFA policy has one approved source; live deployment target is identified.

### 1. Tenant lifecycle and onboarding

- Preserve the prior trial/active state on suspension and restore it explicitly. Keep the action audited and platform-sub-role guarded.
- A server-side dashboard layout now calls the authenticated workspace query before rendering dashboard children and invokes Next `forbidden()` for a suspended tenant; `authInterrupts` is enabled. Verify the actual HTTP 403 using an approved suspended test identity, audit every tenant function for suspension enforcement, and implement/prove the documented device billing/RADIUS degradation cascade.
- Platform tenant navigation, overview actions, and tenant list/detail links use the canonical `/platform/organizations` route aliases; the older `/platform/tenants` paths remain compatible.
- Finish the onboarding checklist: tenant record, WorkOS organization mapping, owner invitation, hostname, initial entitlement, and readiness state must reconcile before the workspace is described as ready.
- Add idempotent retry/recovery visibility for partial provisioning and invitation resend/replace with audit records.
- Keep suspension distinct from cancellation. Cancellation remains blocked until the retention/offboarding flow and retention period are approved.
- Show the actor, affected workspace, result, and audit reference for lifecycle actions.

**Exit criteria:** repeated requests do not duplicate tenant or identity records; partial WorkOS failures can be resumed or safely reviewed; suspended tenants are denied at the tenant authorization boundary; cancellation cannot bypass retention.

### 2. Platform revenue visibility (C1; implementation started, C2 excluded)

- Use the global platform plan catalogue as the shared price source for C3 plan management, C1 contracted MRR/ARR, and public pricing cards. The seeded approved baseline is Starter KES 500/month, Growth KES 1,400/month, Pro KES 3,500/month, with KES as base currency. Plan price mutations are audited; archived plans remain priced for existing entitlements.
- Label MRR/ARR as contracted value from active tenant status plus active entitlements. ARR is MRR × 12. Exclude trials, suspended tenants, and unpriced plan IDs; expose unpriced counts.
- Capture aggregate daily snapshots for trends. Snapshot records contain no subscriber/customer payment data.
- Do not build tenant SaaS invoice generation, invoice payment capture, or invoice reconciliation under C1; canonical C2 remains deferred.

**Exit criteria:** calculations match the approved price contract, unknown plans are not assigned invented prices, historical snapshots are idempotent, direct reads enforce SA/FIN/RO roles, and the figures clearly distinguish contracted value from cash collected.

### 3. Platform access and support

- Keep `/platform/access` as the single access-management surface; legacy `/access` redirects there. Keep the read-only surface role-scoped and leave mutation controls visible only when backend permissions allow them.
- Complete platform staff invitations, role assignment/revocation, pending invitation recovery, and periodic access review.
- Add time-limited, tenant-scoped support grants with purpose, approver, expiry, and audit trail. Support grants must not imply tenant membership or expand a user’s global role.
- Keep impersonation disabled until an explicit policy defines consent, visible session banner, scope, duration, restricted actions, and immutable audit evidence.
- Add platform service identities/API keys only after scope, rotation, last-used reporting, and revocation semantics are specified.

**Exit criteria:** no self-approval or privilege escalation; tenant support access expires automatically and is reviewable; access changes invalidate or refresh sessions; read-only roles cannot invoke writes directly.

### 4. Security, audit, and operations

- Retain the append-only audit log and scheduled full-chain verifier; alert on failed/stale verification and webhook retry/quarantine accumulation.
- Add operational runbooks and dashboards for WorkOS webhook delivery, onboarding failures, entitlement expiry, feature-flag changes, and support access.
- Add access export and data-request workflow only after privacy, retention, deletion, and evidence rules are approved.
- Prove backup/restore, incident response, dependency/security scanning, accessibility, and load behavior as release evidence.

**Exit criteria:** alert ownership and remediation are named; audit integrity is healthy and monitored; recovery evidence meets the documented RPO/RTO; sensitive fields are excluded from logs and exports unless specifically authorized.

### 5. Production rollout

- Reconcile this branch with the 11 newer upstream commits and review all local modifications before release.
- Run role-based UI and direct-function authorization checks, cross-tenant denial checks, onboarding retry tests, billing invariants, and production build gates.
- Deploy additive Convex schema/functions to a verified non-production target first; reconcile data and exercise rollback/recovery before production promotion.
- Verify WorkOS callbacks, MFA/session policy, domain and TLS, alert routing, backup restore, owner training, and support handoff.

**Exit criteria:** signed release review includes environment, evidence, limitations, owner, and remediation status. Local development success alone is not a production-readiness signal.

## Dependencies that cannot be inferred from code

- Approved privileged-role MFA enforcement policy and data-retention schedule. C2 tenant invoice generation is explicitly excluded from build.
- Verified WorkOS and Convex production deployment targets and credentials managed through their approved secret stores.
- Production alert destinations, incident owners, and support staffing.
- Owner approval and auditable guardrails for impersonation, API keys, deletion, and tenant offboarding.


## 2026-10-09 continuation — React RSC timing patch

The isolated production branch includes a package-managed patch for negative `childrenEndTime` values in Next 16.3.8's errored/aborted RSC browser performance measures, plus a regression test. Both production builds and the 230-test suite pass there. Browser verification remains incomplete because the browser connector and local authenticated configuration are unavailable. This checkout's source and dependency tree were not edited; the runtime fix will not appear here until the isolated worktree change is brought in.


## 2026-10-09 continuation — High severity audit findings cleared

`pnpm audit --prod --audit-level=high` identified two admin transitive advisories. Workspace overrides now pin `source-map-js@1.2.2` and `sharp@0.35.5`; the lockfile refresh and frozen install pass, and the audit now reports no known vulnerabilities. Both builds, both typechecks, all 230 tests, token checks, and lint pass (one existing warning). Browser and authenticated runtime verification remain open; this is not production acceptance.

## 2026-10-09 continuation — Legacy no-deletion audit

Completed the source/history status audit in `docs/audits/legacy-route-no-deletion-audit-2026-10-09.md` and mirrored it from the isolated worktree. No route or source was modified, moved, deleted, or retired. The current `/admin` path is a tenant-administration handoff; `/agency`, `/reseller`, and `/partner` are role-gated placeholder pages. Tenant business-reporting routes call distinct tenant analytics, investor, scheduled-report, commission, invoice, and payment handlers; they are separate from similarly named platform modules. `apps/admin` exists but remains source-coupled (49 route entries); `apps/network` is absent. Browser access was denied, so live route rendering was not verified. Before any retirement, require approved route ownership, external inbound-link inventory, redirects, and authenticated permission/data parity checks. Production objective remains active; next: resume app separation and remaining module/security work without deleting these legacy surfaces.

## 2026-10-09 continuation — First platform page/UI extraction

`apps/admin` now contains local source for all 48 existing `/platform` page routes and a local copy of `apps/web/platform/` UI. The old web route files remain intact. Admin alias resolution is local by default with explicit aliases for shared web auth, navigation, Convex and landing helpers. A source-contract test checks route parity and rejects web-route re-exports. Verification: admin lint/typecheck/build passed, the production app-path manifest includes all 48 platform pages, `apps/web` typecheck passed, and the repository suite passed 232/232 tests. Extraction remains partial: admin root layout and proxy import `apps/web`; shared auth/navigation/Convex/UI helpers are still resolved from web. Next: extract these shared contracts into workspace packages and configure deployment only after route/auth verification. Browser verification is blocked by the saved permission preference; external providers and production deployments are still unverified.

## 2026-10-09 continuation — Shared panel access policy package

Extracted the pure role-to-panel policy into `packages/panel-access` (`@mylesnet/panel-access`); both web and admin depend on it, while the existing web auth module remains a compatibility re-export so `requirePanelAccess` behavior is unchanged. Frozen offline install, 232/232 tests, both app typechecks, admin lint/build and all 48 admin platform build-manifest routes pass. App separation remains incomplete: session/auth runtime, proxy, root layout, navigation, and shared Convex/UI adapters are still web-owned or web-aliased. Continue extracting these and preserve legacy routes. Browser access remains blocked by the saved browser permission; production auth/provider/deployment verification remains outstanding.

## 2026-10-09 continuation — Admin-owned root visual shell

`apps/admin` now owns its root layout, global stylesheet, theme initializer, and required logo asset; the web root files remain present. Its 48 `/platform` routes and UI source are local, and `@mylesnet/panel-access` is the shared pure role-policy package. Source-contract tests verify route parity/local shell assets/no web route re-exports. Admin build/typecheck passed; workspace lint passed with one existing web warning; `pnpm test` passed 233/233; token and diff checks passed. Remaining source coupling: proxy, session/auth runtime, navigation, Convex adapters, and UI helpers resolve through `apps/web`. Continue the shared boundary extraction, preserve legacy routes, and defer deployment until authentication and route behavior are verified in an approved environment. Browser access remains blocked by a saved user preference.


## 2026-10-09 continuation — Admin-owned workforce auth entry

The standalone `apps/admin` app now owns its WorkOS/AuthKit proxy, `/signin` page, `/login`, `/auth/callback`, `/invite`, and `/password-reset` route handlers. Callback URLs return to `/platform`, user-visible sign-in errors use fixed product copy, and the standalone entry UI uses semantic design tokens for light and dark themes. The proxy no longer imports the web app's proxy, while host resolution and broader auth/session/Convex/UI modules remain aliased from `apps/web`; this is an incremental extraction, not a completed app split. Verification: admin typecheck and lint passed; admin production build passed; its manifest contains 56 App Router entries, including all 48 platform routes and the local auth entry points; full `pnpm test` passed 236/236, including the new admin auth-boundary source check; `pnpm tokens:check` passed. Browser-level/authenticated redirect behavior is still unverified because Chrome's saved localhost permission blocks inspection. Continue extracting shared platform runtime and complete authenticated route verification before configuring a separate deployment.


## 2026-10-09 continuation — C4 tenant-owned payment gateway foundation

Added `/platform/settings/payments` in both apps with source parity. Super-admins can page through gateway metadata, create a tenant-owned Daraja configuration, archive/restore it, and start credential rotation. Finance can select a tenant and submit only the non-secret environment/short-code update; finance never runs a gateway read query and the main nav keeps C4 hidden from finance because its grant is update-only. A server mutation audits each super-admin settings view; every configuration/rotation mutation audits metadata only. Credential bytes go through an origin- and CSRF-checked Node route to AWS Secrets Manager using a customer-managed KMS key and Vercel OIDC credentials in hosted Vercel. Convex stores only a secret version identifier and returns a configured boolean; credentials are not echoed to the browser. Rotation uses a retained idempotency key on retry.

Verification: 238/238 repository tests pass; 14/14 focused navigation/app-parity audits pass; both app typechecks pass; admin lint is clean; web lint has one existing unrelated `BandwidthCalculatorTool.tsx` warning; token check and `git diff --check` pass. Both production builds complete using the nonfunctional `https://example.convex.cloud` Convex placeholder; a build without `NEXT_PUBLIC_CONVEX_URL` fails during prerender. Placeholder builds prove compilation only, not production runtime. No AWS credentials, production IAM role trust, KMS key, or Safaricom sandbox/live values were provisioned or inspected. C4 is implemented locally in the approved tenant-owned direction, not production-ready: live route/auth behavior, real secret-store permissions, provider handshake and deployment remain unverified. The browser permission setting still blocks `localhost:3000`; that running server is the original checkout, not this worktree.


C4 final gate refresh (2026-10-09): admin and web typechecks pass; admin lint is clean; web lint has one pre-existing `BandwidthCalculatorTool.tsx` warning; 238/238 repository tests and 14/14 focused nav/route-parity checks pass; token check and `git diff --check` pass; `pnpm audit --prod --audit-level=high` reports no known vulnerabilities. `pnpm build` initially failed because `NEXT_PUBLIC_CONVEX_URL` is unset. Re-running with a nonfunctional `https://example.convex.cloud` placeholder completed both web and admin optimized builds and proved that `/platform/settings/payments` and the credential API route are compiled. This is compile evidence only; the placeholder must never be deployed, and authenticated runtime, AWS/Safaricom setup and provider validation remain outstanding.

## 2026-10-10 continuation — PR #72 Greptile review

Greptile reviewed PR #72 at `bce737c` and returned 3/5 with six findings. The current PR worktree addresses tenant attribution for activity records and legacy reads, tenant-scoped uniqueness for subscriber/plan identifiers, subscriber-count migration consistency, support pagination filtering, product-safe API-key copy, and business-facing audit/device detail output. Local typecheck, lint, token check, 43 tests, and `git diff --check` pass. The fixes still need to be pushed and reviewed by Greptile. The PR's reported merge conflicts with `main` remain a separate open item. The owner-designated checkout and its dirty state remain untouched; the local vault copy has not been synchronized from this isolated worktree.
