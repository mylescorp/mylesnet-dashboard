# MylesNet production deployment

This project has two independently deployed surfaces: the Next.js frontend and
the Convex backend. A successful frontend build does not prove that WorkOS,
Convex, RouterOS, or the collector are operational.

## Release gate

Run from the repository root:

```powershell
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run test:collector
npm run test:ui -- --runInBand
npm run build
git diff --check
```

All commands must pass. Lint warnings require review; they are not a substitute
for a failed typecheck or test.

## Deploy order

1. Deploy Convex with the approved production environment file. Never commit or
   print that file.

```powershell
npx convex deploy --env-file .env.deploy --typecheck try --message "<change summary>"
```

2. Deploy the Next.js project from an authenticated Vercel account that owns
   the configured project:

```powershell
npx vercel --prod --yes
```

3. Confirm the deployed frontend points to the production Convex URL and that
   WorkOS callback URLs and allowed origins match the deployed hostname.

## Rollback

For a frontend regression, promote the previous known-good Vercel deployment
from the Vercel project deployment history. For a Convex regression, use the
Convex production deployment history to restore the previous function bundle;
do not edit production data to simulate a rollback.

After rollback, re-run the release gate and verify authentication, role
authorization, market isolation, and a fresh collector sample before declaring
service restored.

## Production verification

The minimum post-deploy checks are:

- sign in as a platform owner and a newly provisioned non-owner;
- confirm WorkOS organization membership and the Convex user/role mirror;
- confirm a non-member cannot read or mutate another market;
- confirm router credentials remain redacted and collector telemetry has a new
  successful sample;
- exercise HealthGuard only with an approved RouterOS maintenance window;
- verify webhook signatures and delivery/replay behavior for Centipid.

If RouterOS is unreachable from the collector host, the release is not proven
operational even when the frontend and Convex deployments are healthy.
