# MylesNet agent work log

Use this file for short, dated entries describing meaningful agent work. Keep
its content synchronized with the owner-designated vault copy at
`/home/myles/Projects/mylescorp-brain/products/mylesnet/work-log.md`. The vault
copy has the required frontmatter and normalizes em dash characters to `--`.

Each entry should state the request/scope, what changed, what was checked, and
what remains. Link to the detailed decision, module register, or operational
record when one exists. Do not include secrets, customer data, or a full routine
transcript here; use `docs/agent-threads/` only for notable sessions under its
separate archive policy.

## Entries

### 2026-10-09 — Runtime error triage during platform implementation

- **Scope:** Check the reported `Receipt is not defined`, inline theme script warning, and negative `TenantDashboardLayout` performance timestamp against the production worktree before proceeding.
- **Findings:** Current `apps/web/shared/navigation/product-nav.ts` has no `Receipt` reference or `/platform/billing/reconciliation` registration; the unbuilt route is therefore not linked from this current nav. Current `apps/web/app/layout.tsx` loads the static `/theme-init.js` through the documented root-layout `beforeInteractive` path and does not render the reported inline `dangerouslySetInnerHTML` script. These two supplied traces are stale relative to this isolated branch; the original checkout and its linked `node_modules` were left untouched. The performance exception exactly matches React's RSC development instrumentation bug for rejected/aborted async server components, where a negative child end timestamp reaches `performance.measure`; see [React issue #37561](https://github.com/facebook/react/issues/37561). It is framework development instrumentation, not application-owned timing code. No authorization redirect/forbidden behavior was changed to hide a development-only renderer defect.
- **Changes:** Replaced only the isolated worktree's dependency symlinks with a frozen offline install, leaving the owner checkout unchanged. Added a package-managed Next 16.3.8 patch for the four browser RSC development bundles: errored and aborted component measures now skip when `childrenEndTime` is negative. Added a regression test that checks both guard sites in all four bundles. The reported dead nav link and inline theme script are already absent in this branch; no app auth behavior was weakened.
- **Verification:** Frozen offline install passed; the regression test and full repository suite passed (230/230); root typecheck and lint passed for both apps (one existing warning in `BandwidthCalculatorTool.tsx`); `pnpm tokens:check` and `git diff --check` passed. Both web and admin production builds passed (172 and 39 routes) with a non-secret Convex placeholder. The isolated dev server started, but the route returned the intended sanitized 503 because auth configuration is absent. The Chrome connector could not load its request-header policy, and the in-app browser is unavailable, so visual browser verification and an authenticated redirect reproduction could not be completed. The error the user sees may still be from the unchanged owner checkout, since this fix is in the isolated branch.
- **Status:** The React development-renderer guard is patched and locked in this isolated worktree, with regression coverage; production builds pass. Browser-level verification remains unproven because the browser connector and local auth configuration are unavailable. Use this worktree (or merge its patch) to pick up the correction; the separate owner checkout remains unchanged. The platform production objective continues.
### 2026-10-09 — E4 referral attribution workflow

- **Scope:** Implement the owner-approved `/platform/referrals` module and bind affiliate attribution to public signup.
- **Changes:** Added validated, auditable affiliate profiles with unique non-reusable referral codes and active/paused/archive/restore lifecycle; passed `/signup?ref=CODE` through server page props; added backend validation and exact self-referral screening; snapshotted global rate/duration in the signup session; committed immutable tenant attribution inside the same internal mutation as active tenant-admin membership; added a paginated SA/FIN/OPS admin view; registered the route in the shared nav and `apps/admin`; added unit and role/source-contract tests.
- **Verification:** `pnpm test` passed 40/40 test files; web/admin typecheck passed; web/admin lint passed with zero errors and the existing `BandwidthCalculatorTool.tsx` warning; `git diff --check` passed. Temporary dependency links were removed.
- **Status:** E4 attribution/admin tracking is Partial: exact self-referral is checked, but corporate ownership/circular referrals still need human review. Reward amount calculation and payouts require an authoritative platform-fee ledger and monthly billing reconciliation; the UI reports amounts unavailable. Convex runtime role/isolation tests, deployment/migration review, CI, and production release remain outstanding. Original checkout remains untouched; vault synchronization remains unavailable due filesystem write boundary.
### 2026-10-09 — Platform runtime error investigation and production continuation

- **Scope:** Fix the reported platform `Receipt is not defined` crash and inline theme-script warning, then resume the persistent platform production objective.
- **Changes:** The current worktree's navigation registry had no `Receipt` reference and no reconciliation route. Left the incomplete reconciliation module unregistered rather than adding a dead link; the supplied stack is therefore not reproducible from this branch, and an exact fix against the reported source remains unverified. Moved the root theme bootstrap into `apps/web/public/theme-init.js`, still loaded with `beforeInteractive`. Reconciled D3 status: automated tenant provisioning is present, but its dedicated client-approval queue is not implemented and its workflow contract remains unspecified.
- **Verification:** Web TypeScript passed after linking shared workspace dependencies; lint passed with 0 errors and one existing warning in `BandwidthCalculatorTool.tsx`. Next dev could not bind port 3000 (`EPERM`), so browser-level runtime confirmation is unverified. Automated tests were not run in that continuation.
- **Status:** Continuing on isolated branch `codex/platform-production`. D3 approval-point choice is pending; the rest of the platform modules/integrations, full release gates, and production deployment remain open. The local vault work-log copy was not synchronized because only `/home/myles/Work` and `/tmp` are writable in this environment.
### 2026-10-09 — Platform MFA policy reporting consistency

- **Scope:** Reconcile the security dashboard's MFA policy response with the mandatory enforcement implemented at the platform authorization boundary.
- **Changes:** `platform:getPlatformSecurityOverview` now returns `mfaMode: "required"` and marks platform staff entries as requiring MFA. The client contract matches, and the security page states that every platform role must enroll before access.
- **Verification:** `node --test convex/lib/mfa.test.ts` and the full repository suite passed (40/40 test files); web/admin TypeScript and direct Convex `platform.ts` TypeScript passed; `pnpm tokens:check` passed; web lint exited with 0 errors and one existing `BandwidthCalculatorTool.tsx` warning; `git diff --check` passed.
- **Status:** Production objective continues on `codex/platform-production`. D3's approval workflow still needs an explicit state/action/approval-point decision. Full release gates, remaining modules, authenticated runtime and provider/deployment evidence remain open. Vault synchronization is unavailable under this workspace's write boundary.
### 2026-10-09 — Platform navigation route integrity

- **Scope:** Prevent platform sidebar entries from linking to routes that are not implemented in the app.
- **Changes:** Extended the platform navigation audit test to resolve every registered sidebar href to a real App Router page source. All 30 current entries are backed by a route; C5 reconciliation stays unregistered while its route and provider data source are absent.
- **Verification:** `node --test apps/web/shared/navigation/product-nav.audit.test.ts` passed; `git diff --check` passed.
- **Status:** The guard is now in the suite; it does not prove role-to-route parity or authenticated runtime behavior. D3's approval-point decision, the remaining modules, full release gates, and production verification remain open.
### 2026-10-09 — C4 payment gateway settings and write-only credential rotation

- **Scope:** Implement the approved tenant-owned Daraja configuration direction for C4 in the isolated platform production worktree.
- **Changes:** Added matching `/platform/settings/payments` pages and UI in `apps/web` and `apps/admin`; SA-only directory access with audited view events; finance update-only public fields with no C4 read query; SA create/archive/restore and metadata-only audit records; direct CSRF/origin-checked credential route backed by AWS Secrets Manager and Vercel OIDC; retries preserve idempotency. No credential values or AWS access keys were written to Convex, logs, docs, or the client response.
- **Verification:** Full repository suite passed 238/238; focused route/nav/parity audits passed 14/14; both apps' typechecks passed; admin lint passed cleanly; web lint passed with the pre-existing `BandwidthCalculatorTool.tsx` warning; token check and `git diff --check` passed. Both production builds passed with the nonfunctional `https://example.convex.cloud` Convex placeholder; the first build without `NEXT_PUBLIC_CONVEX_URL` failed at prerender, and the placeholder build is compile evidence only, not deployment/runtime evidence. Browser verification is blocked by Chrome's saved localhost permission.
- **Status:** C4 is locally implemented, not production-ready. AWS OIDC trust, least-privilege IAM and KMS key, Safaricom credentials/provider validation, authenticated integration tests, app deployment, and browser verification remain open. The current `localhost:3000` process is the original dirty checkout; it was left untouched.
### 2026-10-09 — Admin-owned workforce authentication entry

- **Scope:** Close the extracted `apps/admin` sign-in boundary gap without changing the preserved web compatibility app.
- **Changes:** Replaced the admin proxy's `@web/proxy` delegation with a local AuthKit proxy; added local `/signin`, `/login`, `/auth/callback`, `/invite`, and `/password-reset` handlers. Auth entry flows return to `/platform`; sign-in failures display fixed safe copy; the local sign-in state uses semantic shared tokens across light and dark themes. Added a source-contract assertion and updated the admin README. Host resolution and shared auth/session/Convex/UI modules still resolve from `apps/web`.
- **Verification:** `pnpm --filter @mylesnet/admin typecheck` passed; admin lint passed; admin production webpack build passed and emitted the local auth routes; `pnpm test` passed 236/236. The focused admin source-contract test passed 6/6; `pnpm tokens:check` passed.
- **Status:** Admin auth source is locally owned, but full app independence and authenticated browser behavior are not established. Chrome blocks inspection of `localhost:3000` due its saved permission; no alternate browser path was used. The original checkout's app source remains untouched. Production auth/provider configuration and separate deployment remain unverified.
### 2026-10-09 — Admin-owned root visual shell

- **Scope:** Remove root-renderer and static theme/brand file dependencies on the web app from the separate admin release root.
- **Changes:** Copied the current root layout and global stylesheet to `apps/admin/app/`; copied `/theme-init.js` and the shared MylesNet logo into `apps/admin/public/`. Extended the admin source-contract test to require these local assets and forbid re-exporting the web root layout. The web originals remain unchanged. The WorkOS proxy remains a single shared source in `apps/web` pending a safe common-package extraction.
- **Verification:** Admin production build/typecheck passed and includes all 48 platform routes; workspace lint passed with the existing single web warning; full suite passed 233/233; `pnpm tokens:check` and `git diff --check` passed.
- **Status/next:** Admin now owns page, platform UI, root layout, CSS, theme initializer, and required brand asset. Shared proxy, session/auth runtime, navigation, Convex adapters, and UI primitives still couple it to web sources. Next extract auth/proxy and shell dependencies into workspace packages without changing role policy. Production and authenticated browser verification remain open; browser permission is blocked by a saved preference.
### 2026-10-09 — Shared panel access policy package

- **Scope:** Move the shared pure panel-role allowlist and denial fallback out of the `apps/web` source tree so the new admin app and web compatibility routes consume one policy implementation.
- **Changes:** Added `@mylesnet/panel-access` with the canonical panel role map, `hasPanelAccess`, and `panelAccessFallback`. Kept `apps/web/shared/auth/panelAccess.ts` as a compatibility re-export; existing server `requirePanelAccess` and tests continue to use the same behavior. Added the workspace dependency to both apps and updated the lockfile.
- **Verification:** Frozen offline install passed; full repository suite passed 232/232; web and admin typecheck passed; admin lint and production build passed; build manifest contains all 48 platform page paths; `git diff --check` passed.
- **Status/next:** Pure route-role policy is now a workspace package, but session/auth runtime, proxy, navigation registry, shared Convex adapters, and root layout remain in or aliased to `apps/web`. Continue extracting stable shared boundaries and keep legacy web paths live until migration proof is complete. Browser access remains blocked by a saved preference; no authenticated runtime verification was possible.
### 2026-10-09 — First platform page/UI extraction into apps/admin

- **Scope:** Reduce the source coupling of the separate admin release root without deleting or moving any shipped web route.
- **Changes:** Replaced the 48 `apps/admin/app/platform/**/page.tsx` re-export facades with local copies of the current platform page source; copied `apps/web/platform/` to `apps/admin/platform/`; changed the admin `@/` alias to app-local with explicit web aliases for shared auth, navigation, Convex/client helpers, dashboard helpers, and landing content. Updated the admin README. Added `scripts/audit/admin-platform-source.test.mjs` to assert page-set parity and reject re-exporting platform route modules from `apps/web`. Legacy web routes remain intact.
- **Verification:** Admin lint and typecheck passed; admin production webpack build passed and its app-path manifest contains all 48 platform page paths; the web app typecheck passed; repository suite passed 232/232 tests; `git diff --check` passed.
- **Status/next:** Page and platform UI source are local to `apps/admin`, but app extraction is partial: root layout and proxy still import from `apps/web`, and auth/navigation/Convex/UI helpers still resolve to `apps/web`. Continue by extracting the shared platform shell/auth contracts into workspace packages; keep the source-coupled boundary explicit. Production credentials/deploy and browser auth verification remain outstanding; the browser connector is blocked by a saved user permission preference.
### 2026-10-09 — Legacy route no-deletion audit

- **Scope:** Complete the prerequisite status/evidence audit of legacy `/admin`, `/agency`, `/reseller`, `/partner`, and tenant business-reporting/finance routes before changing app boundaries.
- **Evidence and result:** Added `docs/audits/legacy-route-no-deletion-audit-2026-10-09.md`, mirrored from the isolated production worktree. It traces shipped route facades to their implementation components, panel guards, nav/account references, key Convex queries/mutations, available generic panel tests, and relevant Git path history. It confirms `apps/admin` is a source-coupled release root with 49 route files; `apps/network` is absent. Three legacy partner entrypoints render placeholders; tenant reports remain distinct from platform J4/commission modules. No source or legacy route was modified, moved, or removed.
- **Limits:** Browser access to the owner's `localhost:3000` tab was explicitly denied by the browser security policy, so live rendering remains unverified. The audit does not claim end-to-end RBAC/tenant-isolation certification or prove there are no external deep links.
- **Status/next:** No deletion is authorized. Preserve these routes until each has an owner-approved destination, inbound-link inventory, and replacement permission/data parity proof. Continue the app-boundary and module work; browser verification requires the owner to permit access.
### 2026-10-09 — Clear high severity transitive dependency findings

- Added workspace pins for `source-map-js@1.2.2` and `sharp@0.35.5` after the production audit identified GHSA-68fv-2mgg-jv7q and GHSA-wq5f-xc86-pv6w through the admin app's Next dependency tree. Recorded the decision in `docs/decisions.md` and `docs/technology-stack.md`; the technology-stack mirror is byte-identical across checkouts.
- Verification after refresh: frozen install passed; `pnpm audit --prod --audit-level=high` reports no known vulnerabilities; 230/230 tests pass; both apps typecheck/build; lint passes with one existing web warning; tokens and diff checks pass.
- Status: local high/critical dependency gate is clear. Browser verification and authenticated runtime remain unavailable; production credentials, deployment, integrations, and full platform acceptance are outstanding.
### 2026-10-09 — React RSC development timing guard

- Patched the isolated `codex/platform-production` worktree, not application source in this checkout. The package-managed Next 16.3.8 patch guards rejected/aborted RSC performance measurements in four browser development bundles; a regression test covers those paths.
- Verification on the worktree: 230/230 tests, both app typechecks, lint with one pre-existing warning, token/diff checks, and web/admin production builds passed. Browser check is incomplete: Chrome request-header policy could not load, in-app browser is unavailable, and this checkout has no auth configuration for a local authenticated request. The UI error may still appear here until the isolated branch patch is merged/rebased.
- Status: production goal remains active; owner checkout source edits were not made.
### 2026-10-08 — Platform record deletion sweep

- **Scope:** Remove physical deletion from platform-owned business/control records and retain audited lifecycle history.
- **Changes:** Plan removal now archives; commission-rate overrides gain archive metadata and can be restored by creating the same agency override; SLA overrides archive and can be restored through create; white-label reset archives defaults and save restores them; B2 terminal provisioning requests archive/restore; tenant entitlement removal marks the record expired. Updated UI wording and API result types where behavior changed. Extended static source-contract tests. The bounded platform-session expiry purge remains physical because it removes expired ephemeral session records after their authorization lifetime.
- **Verification:** `pnpm test` passed 39/39 files; `pnpm typecheck` passed web/admin; `pnpm lint` passed web/admin with 0 errors and the existing one warning; targeted `rg` scan of platform handlers found no physical deletes except the session expiry purge; `git diff --check` passed. Temporary dependency links were removed.
- **Status:** Platform business records in this scoped sweep retain history, but the static assertions are not Convex runtime tests or deployment validation. Non-platform delete paths and full module-level validation are outside this sweep and remain for the broader production program. Production deployment/integrations remain unverified; vault records could not be synchronized due workspace write permissions.
### 2026-10-08 — K feature-flag soft deletion

- **Scope:** Enforce the production plan's soft-delete-only invariant for feature controls and ensure archived controls cannot remain effective.
- **Changes:** Added feature-flag archive metadata; changed the SA removal action to disable and soft-archive with an audit entry; added an SA-only restore mutation that restores in the off state; made get/evaluate/security-summary projections exclude archived controls; exposed archived state and restore action in the platform UI. Added a source-contract regression assertion and updated the module register.
- **Verification:** `pnpm test` passed 39/39 files; `pnpm typecheck` passed for web and admin; `pnpm lint` passed for web and admin with zero errors and one existing `BandwidthCalculatorTool.tsx` warning; `git diff --check` passed. Temporary workspace dependency links were removed.
- **Status:** K archive/restore behavior is implemented locally. Convex integration authorization and data-state tests, deployment/migration validation, and production rollout remain open. Other module, app-boundary, integration, and release requirements remain active. The owner checkout is untouched and vault records remain unsynchronized due the write boundary.
### 2026-10-08 — D1 spec-silent read denial

- **Scope:** Fix the D1 platform_readonly detail-query mismatch against the owner role matrix.
- **Changes:** Removed `platform_readonly` from `platformPartners.get`; added a regression assertion that the backend's first-statement role guard permits only SA, OPS, FIN, and SUP. Updated the D1 module register and production checkpoint.
- **Verification:** `pnpm test` passed all 39 test files; `pnpm typecheck` passed for web and admin using temporary worktree-local node_modules links, which were removed afterward; `pnpm lint` passed for web and admin with zero errors and the existing `BandwidthCalculatorTool.tsx` warning; `git diff --check` passed.
- **Status:** D1's spec-silent RO read is denied in code. The static test is not runtime Convex authorization proof. Production release and complete role-matrix evidence remain open. Vault/work-log synchronization remains unavailable under the `/home/myles/Work` and `/tmp` write boundary.
### 2026-10-08 — Persistent production objective checkpoint

- **Scope:** Preserve the owner instruction that MylesNet production readiness remains the top MylesNet objective across future agent sessions, and re-evaluate the next module dependency.
- **Changes:** Root `AGENTS.md` now points future sessions to the production plan and explicitly says not to stop at a plan, partial implementation, green local build, or preview. Updated the production plan with current I3 evidence, blocked gates, and E4 dependency analysis.
- **Evidence:** Current commission code provides agency rate policies and agent/voucher commissions, but no affiliate profile/referral-link attribution or authoritative platform-fee posting source. The public affiliate terms define recurring rewards on platform fees. A reward accrual ledger cannot be safely calculated from the present data model.
- **Verification:** `git diff --check` passed. Previously recorded local checks remain 39/39 test files, typecheck, lint, and token check; the UI test runner, dependency audit, and build have the previously recorded sandbox/network blockers.
- **Status:** No production deployment or production integration is verified. Continue with the E4 attribution and fee-source foundation once it can be tied to the existing affiliate policy and approved billing records, then resume the remaining module and app-boundary work. The worktree is `/home/myles/Work/mylesnet-production` on `codex/platform-production`; all pre-existing worktree modifications are preserved. This environment allows writes only under `/home/myles/Work` and `/tmp`, so the work-log/progress records could not be synchronized into the owner checkout at `/home/myles/Projects/mylesnet-dashboard`.
### 2026-10-08 — I3 product feedback workflow

- **Scope:** Implement the owner-approved feedback route and the smallest auditable intake/triage path across tenant and platform surfaces.
- **Changes:** Added tenant `/feedback` submission form, `/platform/feedback` inbox, a required-tenantId `productFeedback` table with tenant/status/created indexes, bounded cursor pagination, five mapped platform read roles, SA/SUP-only triage and soft archive, required decline reason, and audit entries for tenant submit, triage, and archive. Added the route to the shared nav registry and admin app entrypoints. Added a reusable `packages/ui` Button primitive and used shared UI components for forms, status, loading, empty, and confirmation states. Updated the 47-ID module register delta; E4 remains absent.
- **Verification:** `pnpm test` passed 39/39 test files, including a static source-contract test for I3's first-statement server guards and audit writes; root `pnpm typecheck` passed for web/admin; root `pnpm lint` passed with zero errors and the existing `BandwidthCalculatorTool.tsx` warning; the new shared Button file passed targeted ESLint. `pnpm tokens:check` and platform route parity (46/46 app entrypoints) passed. Admin webpack build reached compilation and failed only when fetching the existing Google Fonts from `fonts.googleapis.com` (`EAI_AGAIN`). `git diff --check` passed.
- **Status:** I3 remains Partial pending role-denial and tenant-isolation integration tests, authenticated route/runtime evidence, full UI light/dark review, and production deployment. Production credentials/targets and release gates remain open.
### 2026-10-08 — Aggregate production gate refresh

- **Scope:** Re-run current branch gates after the app-boundary work and preserve the result as release evidence.
- **Verification:** Root `pnpm typecheck` passed for both workspaces; `pnpm test` passed 37/37 test files; `pnpm tokens:check` passed; root `pnpm lint` completed with 0 errors and 1 warning in `apps/web/landing/components/BandwidthCalculatorTool.tsx`. `pnpm test:ui` failed before test execution because Next/Jest's child Node process for `tsc --showConfig` returns `EPERM` under this sandbox, leaving empty output for Next's JSON parser. The admin production build reached Google font compilation but registry DNS resolution for `fonts.googleapis.com` failed (`EAI_AGAIN`). `pnpm audit --prod --audit-level=high` also failed to reach `registry.npmjs.org` (`EAI_AGAIN`).
- **Status:** Source-level checks are not a release certification; UI Jest, dependency audit, both application production builds, external-service integration, Vercel/Convex target identification, and deployment remain unverified. `git diff --check` passed. The original checkout remains unmodified by this continuation.
- **Read-only structural status:** The separate no-deletion audit is still open; the prior Round 2 audit states its integration sequence was not executed. No source was removed or moved. `/admin` currently hands tenant administrators to `/dashboard/tenant`; agency, reseller, and partner roots are role-gated placeholder pages; `/investor-reports` and `/scheduled-reports` are tenant-side routes, separate from J4's platform scheduled reports. Navigation and account links still point to the legacy panel paths. A complete reference/history review remains required before retirement.
### 2026-10-08 — Platform app boundary foundation

- **Scope:** Continue the production plan by establishing the separate admin release root while preserving every shipped `/platform` route.
- **Changes:** Added `apps/admin` as a pnpm workspace with its own Next.js package/config, root layout and WorkOS proxy entrypoints, and 47 route entry modules covering the current 46 page routes and nested platform layout. The route modules continue to import the protected implementation from `apps/web` during migration; this is explicitly source-coupled and not a completed extraction. Added independent admin dev/start/build commands and included admin in root lint/typecheck/build commands. Updated the pnpm lockfile.
- **Verification:** `pnpm --filter @mylesnet/admin lint` passed with zero warnings after fixing the config export; `pnpm --filter @mylesnet/admin typecheck` passed. The webpack build advanced through route compilation/type analysis and then stopped while fetching Google Fonts because DNS returned `EAI_AGAIN` for `fonts.googleapis.com`. `pnpm install --lockfile-only --offline --store-dir /tmp/mylesnet-pnpm-store` updated the lockfile successfully. A full `pnpm install` was not completed because its attempt to reconcile the pre-existing linked `node_modules` layout required an interactive removal confirmation; those linked dependencies were preserved.
- **Status:** The second app directory and route boundary now exist, but separate Vercel configuration, stable shared-package extraction, app-specific route/error tests, deployment verification, the `apps/network` app, and the no-deletion audit remain open. External-font build verification and production targets remain unverified. No source files in the original checkout were modified.
### 2026-10-08 — Landing chrome: Resources dropdown compaction, nav reorder, MylesCorp page

- **Scope:** Landing-page public chrome and one company page (user-directed UI/content work; the owner production program continues separately in its isolated worktree).
- **Changes:**
  - Compacted the Resources header dropdown: the Guides column (8 links) is capped at 4 with a "View all guides (+4)" reveal button that expands in place ("Show fewer" collapses), shrinking the open panel from 814px to 560px at rest. Mobile sheet, footer, and sitemap keep the full list — the cap is a render-time `maxVisible`/`moreLabel` option on `NavGroup` used only by the desktop panel.
  - Reordered the header nav: Company is now first, Product second; the remaining six items keep their order (still 8 top-level entries, nav width unchanged).
  - Rewrote `/company/mylescorp` from a two-paragraph stub into a comprehensive page using the vault-sourced `@/landing/content/company` module: who we are (entity, Nairobi, core market), how we work (operating model), the company behind MylesNet (portfolio note without cross-selling), built from operators' realities (field context from the v3 spec: East African operating conditions, evidence-led scope), the M.Y.L.E.S. Principle (5 values), leadership with direct contact lines, and a closing CTA to About MylesNet, the product, and the MylesCorp site.
- **Files:** `apps/web/landing/content/navigation.ts`, `apps/web/landing/components/Header.tsx`, `apps/web/app/(public)/landing.css`, `apps/web/landing/routes/company/mylescorp/page.tsx`.
- **Verification:** Live browser checks at localhost:3000 — nav order Company→Product→Features→Solutions→Pricing→Integrations→Resources→Security; Resources dropdown compact 560px (Guides 4 + View all) → expanded 864px (Guides 8 + Show fewer) → collapse; Company dropdown and all routes unaffected; MylesCorp page renders h1, 7 sections, 21 cards, correct internal/external CTAs; horizontal overflow 0 on every check. `tsc --noEmit` and token checks show no errors/violations in the changed files (pre-existing errors in concurrent platform-panel work remain in the dirty tree and are not mine). No new routes were added, so `ALL_PUBLIC_ROUTES` and sitemap are unchanged.
- **Status:** Complete. Not committed — the working tree is heavily dirty with unrelated in-progress work per vault rules.
### 2026-10-08 — Platform session enforcement continuation

- **Scope:** Continue the owner-approved production implementation in the isolated worktree.
- **Changes:** Added Convex-backed 30-minute platform inactivity and 12-hour absolute session enforcement, a minute-25 warning, server activity heartbeats, role-fingerprint invalidation, server revocation on platform sign-out/timeout, and bounded daily pruning. Narrowed generic panel reads to the five mapped roles; restricted J3 to SA/RO, payout/report reads to SA/FIN, broadcast reads to SA/SUP, and analytics reads to SA/OPS/FIN/RO. Tenant snapshot reads now verify active tenant permission, market ownership, and market membership. Corrected directory super-admin mapping so both platform owner/admin aliases are recognized. Added policy boundary tests and an AccountDrawer revoke-before-WorkOS-signout regression test.
- **Verification:** Isolated worktree `pnpm typecheck` passed; `pnpm test` passed 36 test files; UI Jest passed 1 suite / 12 tests; `pnpm tokens:check` passed; lint passed with zero errors and one existing warning in `BandwidthCalculatorTool.tsx`; webpack production build exited 0 and generated all 167 routes with a non-secret placeholder Convex URL. `pnpm audit --prod --audit-level=high` could not reach npm because registry DNS returned `EAI_AGAIN`.
- **Status:** App split, remaining modules and provider integrations, `pnpm audit` (registry DNS unavailable), live production configuration, deployment, and release sign-off remain open. Changes are in isolated branch `codex/platform-production` at `/home/myles/Work/mylesnet-production`.
### 2026-10-08 — Project README, vault reference, and release-guide refresh

- **Scope:** Analyze the MylesNet source tree and owner-designated local vault
  checkout; give future developers a practical setup, architecture, security,
  verification, and release guide.
- **Changes:** Expand root README; point root/web agent guidance to the local
  vault and require a work-log entry plus relevant canonical record for
  meaningful tasks; document vault path/portability/safety; align production
  deployment steps with actual pnpm/CI workflows; replace historic Windows-only
  vault references in the active no-stack and agent-thread guidance.
- **Evidence checked:** Repository instructions, root/web README and panel map,
  stack and architecture records, production deployment guide, module register,
  public/panel route layout, Convex source layout, package/service boundary
  READMEs, workflow scripts, and the local vault checkout's branch/working-tree
  status. No secret-bearing environment files were read.
- **Verification:** `git diff --check` and local Markdown link-target checks
  passed for the documentation changes. After CI surfaced the existing
  Next.js advisory, `pnpm audit --prod --audit-level=high` passed locally with
  the 16.3.8 patch. Automated tests/build were not run locally; CI must verify
  them on the updated PR.
- **Status:** The documentation set is synchronized into the owner-designated
  local vault checkout. The initial PR preview passed; CI's production audit
  found the pre-existing Next.js pin was below the security-patched release.
  Next.js and `eslint-config-next` are now pinned at 16.3.8 with a regenerated
  lockfile; CI and preview need to pass on the updated commit before merge.
### 2026-10-08 — Platform session enforcement

- **Scope:** Continue the owner-approved production implementation in the isolated worktree.
- **Changes:** Added a server-side 12-hour absolute lifetime and a Convex-backed 30-minute inactivity window for platform sessions, with a 25-minute warning and client activity heartbeat. Session rows bind the authenticated user and current platform-role fingerprint; role changes fail closed for the prior session. Added pure boundary tests for session lifetime, inactivity, and derived identity/role keys.
- **Verification:** `pnpm typecheck` passed; `pnpm test` passed 36 test files; `pnpm tokens:check` passed; `pnpm lint` has zero errors and one existing warning in `BandwidthCalculatorTool.tsx`. A production webpack build passed compilation/typecheck and prerendered 167 pages using non-secret `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud`; final status is pending.
- **Status:** Work continues on `codex/platform-production` in the isolated worktree. The app split, remaining modules/integrations, UI Jest, audit/security gates, production target verification, deploy, and release sign-off remain open.

### 2026-10-10 - Greptile PR Gate and vault path correction

- **Scope:** Install Greptile repository review rules and correct the configured local vault references.
- **Changes:** Added the mandatory PR gate, Greptile configuration, review template, and a dated tooling-only decision. Corrected repo instructions to point at `/home/myles/Projects/mylescorp-brain/`. Vault-wide rollout was added for all ten product folders.
- **Verification:** Greptile file names and schema checked against its official file reference. Mirror pairs were compared before edits; divergent pairs were left unchanged. No runtime dependency was added.
- **Status:** PR review, required CI checks, and branch protection remain to be verified. The vault work-log copy was added at `products/mylesnet/work-log.md` with required frontmatter.

### 2026-10-10 - Greptile gate baseline verification

- Scope: Verify clean-main failures and amend the gate wording before opening its PR.
- Baseline: clean local main at `8ceb418` reproduced C5 reconciliation errors (nullable `reason`, two invalid `StatusPill` props, missing `Receipt`, and payment-status union mismatch), plus a missing `PageProps` type before Next generated route types and a sandbox `.tsbuildinfo` write error. Blame attributes all five C5 errors to `8ceb418`. Current PR base `origin/main` at `2493c6c` passes typecheck; tests pass 171/171; lint has zero errors and 15 warnings.
- Gate build: before rebasing, production compilation succeeded and typecheck stopped on the five C5 errors from stale local main. No process was stopped; the owner's dev server was not touched.
- Changes: amended steps 3 and 8 in repo/vault gate, added the PR template baseline section, recorded the vault work-log path, and prepared a mirror-divergence report.
- Status: local-main C5 failures do not exist on current origin/main and are not current PR baseline failures. Rebased the gate onto `origin/main` so the PR contains one commit and no unrelated history. The rebased branch passed `pnpm typecheck`, `pnpm test` (171/171), `pnpm lint` (zero errors, 15 warnings), and `pnpm build` (131 generated pages). GitHub CI security fails its production dependency audit on unchanged baseline `next` below patched 16.3.8 (GHSA-cjq9-62q9-8jv4); secret scanning passed. Do not change runtime dependencies in this gate PR. Greptile review remains pending.


### 2026-10-10 - Greptile review round 1

- Review: Greptile returned 4/5 with two P2 findings about post-review record commits and the mapped work-log path. Both findings were valid.
- Changes: Final review record updates are now committed before the final review; the final Greptile summary on the final commit is canonical score evidence, with no record-only commit after 5/5. Vault reference step 3 now names `products/mylesnet/work-log.md`. Repo and vault gate wording match.
- Status: Fix commit pushed to PR #73. Waiting for re-review; no branch protection changes applied.
