# @mylesnet/admin — platform control plane

Separately deployable Next.js app that serves the MylesNet platform control
plane (`/platform`). It is **additive**: `apps/web` still serves `/platform`,
and no legacy surface is removed until the approved no-deletion migration gate
(`docs/audits/legacy-route-no-deletion-audit-2026-10-13.md`) completes.

## What this app owns

- The `/platform` route surface, mirrored from `apps/web` and then owned here.
- The auth routes the panel needs while it authenticates itself:
  `/auth/callback`, `/signin`, `/sign-out`, `/login`, `/password-reset`,
  `/invite`, `/no-access`.
- Its own build, lint, typecheck, and Vercel project (`vercel.json`).

## What it reuses today

While both apps ship the same panel, the panel implementation
(`apps/web/platform`) and the shared runtime (`apps/web/shared`, the `convex`
backend) are consumed through the `tsconfig.json` path aliases instead of being
copied. Authorisation therefore cannot diverge between the two deployments, and
one role-map change cannot reach only one of them.

`scripts/audit/admin-platform-boundary.test.mjs` (part of `pnpm test`) enforces
that the platform route tree, root/panel layouts, `proxy.ts`, and the mirrored
auth route files stay byte-identical to `apps/web` for as long as both apps ship
`/platform`. When this app takes ownership of the panel source, that test and
the `@source` declarations in `app/globals.css` are updated together.

## Local development

```bash
pnpm install
pnpm --filter @mylesnet/admin run dev     # http://localhost:3001
pnpm --filter @mylesnet/admin run build
pnpm --filter @mylesnet/admin run lint
pnpm --filter @mylesnet/admin run typecheck
```

`NEXT_PUBLIC_CONVEX_URL` is required at runtime (and at build time in CI).

## Not yet done

- Platform-only shell/navigation (the shared `AppShell` still renders every
  panel the signed-in user can reach).
- A platform-scoped public-path list (the auth proxy currently reuses the
  website's `PUBLIC_PATHS`).
- A platform-oriented post-login return target: the shared auth routes still
  return to `/dashboard`, which this app does not serve. The `authkitMiddleware`
  proxy path (sign-in from `/platform` and back) is unaffected.
- Deployment target and domain confirmation.
