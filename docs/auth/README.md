---
type: reference
status: active
date: 2026-09-14
tags: [mylesnet, auth, rbac, workos, nextjs]
---

# MylesNet Auth Implementation Notes

> Canonical scope for authentication, RBAC, session, and cookie work on `mylesnet-dashboard`. This note is a byte-identical mirror of the repo file `docs/auth/README.md` — keep both in sync. Task register: [[../tasks/active|MylesNet Active Tasks — AUTH lane]] / [[../tasks/backlog|MylesNet Backlog — Authentication lane]].

## Direction (fixed)

- **Workforce identity**: WorkOS AuthKit ([[../../technology-stack|technology stack]]).
- **Subscriber identity**: Auth0 phone-OTP-first (future, S-AUTH). Portal authentication never grants staff/network privileges.
- **Convex is the enforcement plane.** The proxy layer only does optimistic routing; every query/mutation/http route re-checks identity, membership, role, and MFA in Convex. See [[../../Cookie Handling|Cookie Handling]], [[../../CSRF Protection|CSRF Protection]], [[../../Audit Log Standards|Audit Log Standards]], [[../../Role-Based UI Visibility Standards|Role-Based UI Visibility Standards]].
- Canonical panel map: `/platform`, `/admin`, `/dashboard`, `/reseller`, `/agency`, `/partner` ([[../design/rbac-panel-hierarchy/99-mylesnet-orientation|MylesNet Orientation]]).

## Next.js 16 note

`middleware.ts` is deprecated in Next.js 16 and renamed to **`proxy.ts`** (root of the app directory, default-export `proxy(request, event)`, Node runtime). The vault RBAC-routing doc `04-nextjs-middleware-routing-with-rbac.md` predates this; its intent is implemented with `proxy.ts`. Proxy only does optimistic checks — full session/authorization lives in the data layer (Convex).

## Files

### Convex (enforcement) — implemented, verified (107 tests green, 2026-09-14)

| File | Purpose |
|---|---|
| `convex/schema.ts` | `authTables()` (WorkOS/AuthKit), `users` (+ `mfaEnrolled`, `mfaEnrolledAt`), `auditLog`, etc. |
| `convex/auth.config.ts` | WorkOS customJWT providers; Convex reads `identity.organizationId` + `subject`. |
| `convex/workos.ts` | `ensureOrgMembership` (role + MFA sync), `getWorkosUserByEmail`, `getWorkosMfaEnrollment`. |
| `convex/workosWebhook.ts` | Event processing: user/membership/invitation/session/role. |
| `convex/http.ts` | Route surface: `/workos/webhook` (HMAC-verified via `convex/lib/workosVerify.ts`), `/collector/ingest`. |
| `convex/lib/auth.ts` | Server guards (`requirePlatformAdmin`, `requirePlatformOwner`, permissions), role resolution, `assertMfaCompliance`. |
| `convex/lib/permissions.ts` | Permission catalogue + system role slugs source of truth. |
| `convex/lib/tenant.ts` | Tenant resolution from WorkOS org membership; bootstrap slug `mylesnet`. |
| `convex/lib/mfa.ts` | Pure MFA policy (mandatory-2FA roles, fail-closed compliance) + `mfa.test.ts`. |
| `convex/platformUsers.ts` | `syncWorkosIdentity` internal mutation (persists MFA mirror). |

### Apps/web — implemented, verified

| File | Purpose |
|---|---|
| `apps/web/proxy.ts` | AuthKit proxy: per-host callback URI (`resolveMylesnetHost` + `callbackUriForHost`), trailing-slash 308 normalization, 421 on unknown host, `__mylesnet_tenant` cookie from hostname, additive security headers, 503 cookie-password gate. Public paths derived from `PUBLIC_PATHS`. |
| `apps/web/app/(app)/auth/callback/route.ts` | AuthKit callback with PKCE-replay resilience. |
| `apps/web/app/(app)/signin/route.ts` | Redirect to WorkOS hosted auth. |
| `apps/web/app/components/OrgGuard.tsx` | After-login org membership + role sync orchestrator. |
| `apps/web/app/lib/convex.ts` | Typed Convex client + `ConvexProviderWithAuth`. |
| `apps/web/lib/auth/cookies.ts` | `__mylesnet_*` cookie names/options (httpOnly+secure+sameSite+path+maxAge), host-only scope, clear-by-empty pattern (Cookie Handling). |
| `apps/web/lib/auth/csrf.ts` | Pure double-submit core: token generation, well-formedness, constant-time verify; header `X-CSRF-Token`. |
| `apps/web/lib/auth/tenant.ts` | Canonical host resolver: apex / panel / tenant / development / unknown (`MYLESNET_PUBLIC_DOMAIN` allow-list), `callbackUriForHost`, `tenantSlugFromHost`, bootstrap slug. |
| `apps/web/lib/auth/session.ts` | Server session facade over `getTokenClaims`: `getSession`, `requireUser`, `requireRole`, `getActiveTenantSlug` (AuthRequiredError / RoleRequiredError). |
| `apps/web/lib/auth/rbac.ts` | Pure optimistic UI helpers: role/panel/permission checks, claim flattening. |
| `apps/web/lib/auth/panelAccess.ts` | Panel role-requirement map incl. historical `org-*` slugs; `hasPanelAccess`. |
| `apps/web/lib/auth/panels.ts` | `requirePanelAccess(panel)` server gate; agency/partner data-dark behind env flags. |
| `apps/web/lib/public-routes.ts` | `PUBLIC_PATHS` derived from landing content (drives proxy allow-list + sitemap). |
| `apps/web/lib/convex/tenantControl.ts` | Typed function references for the tenant-control surface (pinned). |
| `apps/web/lib/utils.ts` | `cn()` (clsx + tailwind-merge). |

### Verification (2026-09-14)

- `pnpm test` — 107/107 (convex pure-lib tests + web `lib/auth` node:test: csrf, tenant, rbac, panelAccess).
- `pnpm --filter @mylesnet/web run typecheck` — 0 after `next typegen` (stale `.next/types` artifacts from a running dev server are environmental, not code).

## Cookies

- Session cookie: AuthKit-managed (`WORKOS_COOKIE_NAME`, default `wos-session`), httpOnly, Secure, SameSite=Lax, rotation on privilege change.
- App cookies: `__mylesnet_tenant` (hostname-resolved tenant slug, set in proxy), `__mylesnet_csrf` (double-submit token). Cookies are **host-only** (`MYLESNET_COOKIE_DOMAIN` unset): a panel/tenant session is never sent to a sibling subdomain. CSRF cookie is the documented httpOnly=false exception (double-submit requires JS read).

## Environment (`.env.example`)

`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_COOKIE_NAME`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (+ sign-up/invite/password-reset/login URLs), `MYLESNET_PLATFORM_ORG_ID`, `MYLESNET_NETWORK_ORG_ID`, `MYLESNET_BOOTSTRAP_OWNER_EMAILS`, `MYLESNET_PUBLIC_DOMAIN` (host allow-list), `MYLESNET_COOKIE_DOMAIN` (unset/host-only), `NEXT_PUBLIC_ENABLE_AGENCY_PANEL`, `NEXT_PUBLIC_ENABLE_PARTNER_PANEL`, `NEXT_PUBLIC_ENABLE_RBAC_SHADOW_MODE`, `NEXT_PUBLIC_RBAC_ENFORCEMENT_LEVEL`.

## MFA position (2026-09-14)

- WorkOS owns enrollment. App mirrors enrollment onto `users.mfaEnrolled` / `users.mfaEnrolledAt` at reconcile (`getWorkosMfaEnrollment` → `ensureOrgMembership` → `syncWorkosIdentity`); `convex/lib/mfa.ts` enforces mandatory 2FA for `platform_owner`, `platform_admin`, `ops_manager`, `finance_manager`; `assertMfaCompliance` fails closed in `requirePlatformAdmin`/`requirePlatformOwner` (shadow mode via RBAC env flags). Full in-app setup UI + WorkOS org-level MFA policy config is backlogged (Phase 2).