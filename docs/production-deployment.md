# MylesNet production deployment

MylesNet has two independent application release boundaries:

1. The Next.js web application deployed through Vercel.
2. The Convex schema/functions deployed to a selected Convex environment.

A successful web deployment does not prove that the matching Convex functions,
schema, authentication configuration, callbacks, or operational integrations
are healthy. Check the current deployment records before every release; status
in a runbook is not a substitute for live evidence.

## Preconditions

- The PR is based on current `main`, has a reviewable diff, and has passing CI,
  security, CodeQL, and Vercel Preview checks.
- The production Convex target and approved deployment credential are explicitly
  known. Never infer the target from `NEXT_PUBLIC_CONVEX_URL` or a local default.
- Production values are stored only in approved secret storage or the approved,
  untracked deployment environment file. Never print or commit `.env.deploy`.
- Schema changes comply with the retirement/data-export gate in
  [`architecture/legacy-retirement.md`](architecture/legacy-retirement.md).
- The selected Vercel project, production branch, site URL, Convex URL, and
  WorkOS redirect/origin settings have been confirmed for the release.

## CI release gate

The repository CI workflow is authoritative for automated quality checks. Its
quality job installs the frozen workspace and runs:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm tokens:check
pnpm test
pnpm --filter @mylesnet/web run test --runInBand
pnpm build
```

CI also runs secret scanning and dependency auditing, CodeQL, and filesystem
scanning when container files are present. Locally, also run:

```bash
pnpm landing:check
git diff --check
```

Investigate lint warnings and test failures; do not describe a release gate as
passing unless the checks completed successfully on the release commit.

## Deployment order

1. Review the Convex diff and confirm the exact approved production deployment.
   Deploy only with the owner-approved environment file and credentials:

   ```bash
   pnpm exec convex deploy --env-file .env.deploy --typecheck try \
     --message "<reviewed change summary>"
   ```

   Do not create an `.env.deploy` from guessed values. If the target or key is
   missing, stop the backend deployment and report what is needed.

2. Merge the reviewed PR after all required checks pass. Vercel builds a Preview
   for review. The production deployment is produced from the configured
   production branch according to the Vercel project settings.

3. Confirm the production Vercel deployment is Ready and corresponds to the
   merged commit. Confirm the deployed web environment points at the approved
   production Convex deployment. Check the public domain and authentication
   callback/origin configuration.

4. Run the post-deploy checks below. A Vercel Ready status is deployment
   evidence for the web artifact only; it does not prove backend operation.

## Post-deploy verification

- Confirm public routes such as `/`, `/pricing`, and `/legal/terms` return the
  expected content on the configured production domain.
- Complete workforce sign-in with an authorized platform account and a
  provisioned tenant account.
- Confirm WorkOS organization mapping, the Convex user/role mirror, and active
  membership behavior for the approved test accounts.
- Confirm a tenant member can read only their own workspace data and a
  non-member cannot read or mutate another tenant's market/subscriber data.
- Confirm that platform role gates match the documented matrix and that denied
  responses use safe user-facing copy.
- Confirm router credentials and other sensitive integration data remain
  redacted in authorized views and are absent from ordinary user screens.
- Verify webhook signature and replay/idempotency behavior for integrations
  enabled in the deployed system.
- Record the Vercel deployment URL/commit, Convex target identifier (never the
  credential), verification date, test scope, and unresolved issues in the
  appropriate project/vault release record.

Do not test against a live router, issue a payment, mutate customer data, or
trigger a destructive operation without an approved test identity and
maintenance/test window. RADIUS, network-worker, communications, mobile, and
infrastructure checks become release requirements only when those services are
implemented and approved for deployment; their planned directories are not
evidence that they are live.

## Rollback

- For a web regression, promote the previous known-good Vercel deployment using
  the Vercel project history and verify the resulting production URL.
- For a Convex function regression, use the approved Convex deployment history
  and documented Convex rollback process. Do not edit production data to imitate
  a code rollback.
- If a schema change is not backward compatible, coordinate the backend and
  frontend rollback order against its migration plan before acting.
- Re-run the relevant release checks and verify authentication, role
  authorization, and tenant isolation after rollback.

## Current operational limitation

Convex and Vercel are separate deployment targets. In the absence of an
explicitly approved Convex target and deployment credential, backend deployment
is blocked even when GitHub CI and Vercel are green. Record this as an open
release blocker rather than attempting a guessed deployment.
