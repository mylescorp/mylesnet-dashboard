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
| `apps/web/app/(panels)/auth/callback/route.ts` | AuthKit callback with PKCE-replay resilience. |
| `apps/web/app/(panels)/signin/route.ts` | Redirect to WorkOS hosted auth. |
| `apps/web/shared/components/OrgGuard.tsx` | After-login org membership + role sync orchestrator. |
| `apps/web/shared/lib/convex.ts` | Typed Convex client + `ConvexProviderWithAuth`. |
| `apps/web/shared/auth/cookies.ts` | `__mylesnet_*` cookie names/options (httpOnly+secure+sameSite+path+maxAge), host-only scope, clear-by-empty pattern (Cookie Handling). |
| `apps/web/shared/auth/csrf.ts` | Pure double-submit core: token generation, well-formedness, constant-time verify; header `X-CSRF-Token`. |
| `apps/web/shared/auth/tenant.ts` | Canonical host resolver: apex / panel / tenant / development / unknown (`MYLESNET_PUBLIC_DOMAIN` allow-list), `callbackUriForHost`, bootstrap slug. |
| `apps/web/shared/auth/session.ts` | Server session facade over `getTokenClaims`: `getSession`, `requireUser`, `requireRole`, `getActiveTenantSlug` (AuthRequiredError / RoleRequiredError); `authenticatedAt` is the WorkOS `auth_time` claim. |
| `apps/web/shared/auth/sessionPolicy.ts` | Approved platform session policy (`PLATFORM_SESSION_POLICY`: 30 / 25 / 720 minutes) and the pure evaluators shared by the server gate and the browser guard, plus per-session activity keys; `sessionPolicy.test.ts`. |
| `apps/web/shared/auth/platformSession.ts` | Server half: reads the sign-in time from the session and redirects to `/sign-out` when the 12-hour absolute cap has elapsed. |
| `apps/web/shared/auth/routes/sign-out.ts` | Ends a WorkOS session and returns the visitor to sign-in (host-scoped return target from the approved host allow-list). |
| `apps/web/shared/components/SessionGuard.tsx` | Browser half: 30-minute inactivity sign-out, 25-minute warning banner, cross-tab activity sharing, absolute-cap backstop; `SessionGuard.test.tsx`. |
| `apps/web/shared/auth/rbac.ts` | Pure optimistic UI helpers: role/panel/permission checks, claim flattening. |
| `apps/web/shared/auth/panelAccess.ts` | Panel role-requirement map incl. historical `org-*` slugs; `hasPanelAccess`. |
| `apps/web/shared/auth/panels.ts` | `requirePanelAccess(panel)` server gate; agency/partner data-dark behind env flags. |
| `apps/web/shared/public-routes.ts` | `PUBLIC_PATHS` derived from landing content (drives proxy allow-list + sitemap). |
| `apps/web/shared/convex/tenantControl.ts` | Typed function references for the tenant-control surface (pinned). |
| `apps/web/shared/utils.ts` | `cn()` (clsx + tailwind-merge). |

### Verification (2026-09-14)

- `pnpm test` — 107/107 (convex pure-lib tests + web `lib/auth` node:test: csrf, tenant, rbac, panelAccess).
- `pnpm --filter @mylesnet/web run typecheck` — 0 after `next typegen` (stale `.next/types` artifacts from a running dev server are environmental, not code).

## Cookies

- Session cookie: AuthKit-managed (`WORKOS_COOKIE_NAME`, default `wos-session`), httpOnly, Secure, SameSite=Lax, rotation on privilege change.
- App cookies: `__mylesnet_tenant` (hostname-resolved tenant slug, set in proxy), `__mylesnet_csrf` (double-submit token). Cookies are **host-only** (`MYLESNET_COOKIE_DOMAIN` unset): a panel/tenant session is never sent to a sibling subdomain. CSRF cookie is the documented httpOnly=false exception (double-submit requires JS read).

## Environment (`.env.example`)

`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_COOKIE_NAME`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (+ sign-up/invite/password-reset/login URLs), `MYLESNET_PLATFORM_ORG_ID`, `MYLESNET_NETWORK_ORG_ID`, `MYLESNET_BOOTSTRAP_OWNER_EMAILS`, `MYLESNET_PUBLIC_DOMAIN` (host allow-list), `MYLESNET_COOKIE_DOMAIN` (unset/host-only), `NEXT_PUBLIC_ENABLE_AGENCY_PANEL`, `NEXT_PUBLIC_ENABLE_PARTNER_PANEL`, `NEXT_PUBLIC_ENABLE_RBAC_SHADOW_MODE`, `NEXT_PUBLIC_RBAC_ENFORCEMENT_LEVEL`.

## MFA position (2026-10-12 — owner-approved, single source)

- **Policy:** MFA is mandatory for **every** platform role. The mandatory set is derived from the role registry (`SYSTEM_ROLES` entries with `isPlatform: true`): `platform_owner`, `platform_admin`, `member`, `ops_manager`, `finance_manager`, `market_manager`, `investor_viewer`, `platform_support`, and `platform_readonly`, and it cannot drift as roles are added. There is no optional tier. This supersedes the 2026-09-14 and 2026-10-08 notes.
- WorkOS owns enrollment. The app mirrors enrollment onto `users.mfaEnrolled` / `users.mfaEnrolledAt` at reconcile (`getWorkosMfaEnrollment` → `ensureOrgMembership` → `syncWorkosIdentity`). Removing a factor clears the mirrored timestamp, and an explicit `mfaEnrolled: false` always denies even if a stale timestamp survives.
- `convex/lib/mfa.ts` is the single policy source (`MFA_ENFORCEMENT_MODE = "required"`, `MANDATORY_MFA_ROLES`, `isMfaCompliant`, `unmetMfaRoles`, `assertMfaCompliance`; fail closed). `convex/lib/auth.ts` enforces it in every platform authorization gate: `requirePlatformUser`, `requirePlatformAdmin`, `requirePlatformOwner`, `requireAnyRole`, `requireOpsOrAbove`, `requireFinanceOrAbove`, `requireInvestorViewer`, the platform branch of `requirePermission`, `requirePlatformSubRole`, and `requirePlatformSubRoleForUser`. The platform-wide (cross-tenant) report path also checks it — `scheduledReports.canReadPlatformReports` and the platform branch of `scheduledReports.requireReportExportActor` — while tenant-scoped report reads and exports are unchanged. A user whose roles include no mandatory platform role is unaffected, so tenant-facing handlers are unchanged.
- A platform role without the enrollment mirror is denied: platform users must complete WorkOS MFA enrollment to use the platform. In-app setup UI and WorkOS org-level MFA policy configuration remain Phase 2 backlog (no self-service enrollment UI here).

## Session policy (2026-10-12 — owner-approved)

- 30 minutes of inactivity ends a platform session; the user is warned at 25 minutes; the absolute session lifetime is 12 hours.
- The values live in exactly one place, `PLATFORM_SESSION_POLICY` in `apps/web/shared/auth/sessionPolicy.ts`, and are imported by both enforcement halves so the server and the browser cannot disagree. They are also fixed in this document and in `docs/decisions.md`.
- **Server (absolute cap):** `apps/web/shared/auth/platformSession.ts` reads the sign-in time (`auth_time`) from the session returned by `requirePanelAccess("platform")` — which now returns the session instead of `void` — and redirects to `/sign-out` in `apps/web/app/(panels)/platform/layout.tsx` once the 12-hour cap has elapsed, before any platform markup renders. `/sign-out` (`apps/web/shared/auth/routes/sign-out.ts`, thin stub at `apps/web/app/(panels)/sign-out/route.ts`) ends the WorkOS session and returns the visitor to sign-in; an unauthenticated visitor is sent straight there. This path holds without client JavaScript.
- **Browser (idle timeout and warning):** `SessionGuard` is mounted by the platform layout. It warns at 25 minutes of inactivity, signs out at 30 minutes, and also enforces the 12-hour cap in-page. Activity is shared across tabs through `localStorage`, keyed by the WorkOS `sessionId`, so an idle background tab is not signed out while another tab is active. The absolute cap prefers the server-supplied sign-in time and otherwise falls back to the first observed platform visit for that session. Two rules keep the timeout honest: a page load only counts as activity while the stored activity is still inside the policy window (reopening a platform tab after the timeout ends the session instead of resuming it), and activity arriving after the window has closed ends the session instead of extending it. The expiry notice is modal (focus moves to the sign-in action, the page underneath is inert) and its action is `/sign-out`, so a failed automatic sign-out still has a working recovery path.
- Verification: `sessionPolicy.test.ts` (13 cases: policy values, state boundaries, absolute precedence, clock skew, key isolation, timestamp parsing) runs under `node --test`; `SessionGuard.test.tsx` (10 cases: quiet state, warning, idle sign-out, modal focus and sign-in action, stale-activity page load, returning to an idle tab, failed-sign-out retry, cross-tab activity, absolute cap under activity, no-session no-op) runs under the web jest project.
