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

## 2026-10-10: restore newer platform features

Prepared the reviewed platform feature bundle on `feat/restore-platform-features`, preserving the existing dirty production worktree. Restored platform analytics and leaderboard, API key management, payment reconciliation and anomaly review, commissions and payouts, agency/reseller lifecycle, RADIUS fleet, and the platform organization API. Reconciled schemas with current-main security and tenant lifecycle fields and corrected C5 reconciliation type errors. Web typecheck, backend typecheck excluding tests, 37 repository tests, and focused frontend lint passed. Build remains blocked by dependencies linked from outside this isolated clone. GitHub authentication is invalid, so no PR has been pushed or opened. The PR note will be linked after the PR is opened.

### 2026-10-10 — Platform RBAC, navigation, and organization provisioning

- **Scope:** Continue production work on platform roles and missing sidebar features.
- **Changes:** Central platform route scopes now override stale link-level role lists and deny new unscoped routes by default. Added the `/platform/billing` revenue link. Limited organization creation to super-admin and ops in navigation UI and the server route. Replaced the organization form's no-op logging/redirect with the existing audited provisioning action and required administrator email.
- **Verification:** 41/41 repository tests, web typecheck, focused ESLint, full lint with 0 errors and 15 warnings, and scoped whitespace checks passed. Production build was attempted in the isolated worktree: Turbopack failed to bind an internal port; webpack fallback could not parse TypeScript `--showConfig`. No authenticated runtime check or deployment was performed.
- **Status:** Local commits are on `fix/platform-owner-access-rbac`; GitHub push and Greptile review remain blocked by invalid stored GitHub credentials and unavailable DNS. The owner checkout/server was untouched. Repo/vault work-log, production-plan, and module-register copies are currently divergent; per the no-overwrite rule, the vault copies were not modified. Remaining module scope and release gates are still open.

### 2026-10-10 — B4 policy-template and platform role hardening

- **Changes:** Removed invented initial network-policy values from the policy-template form, required an explicit access type, omitted empty optional fields from Convex payloads, and extracted validation into a tested pure module. Added UI role-helper coverage for tenant, plans, infrastructure, delete, and white-label operations, including owner aliases.
- **Verification:** Web and direct Convex TypeScript checks passed; full lint completed with 0 errors and 11 warnings; `pnpm test` passed 42/42; `git diff --check` passed. No browser-authenticated role test or deployment was performed.
- **Status:** The B4 work is local on `fix/platform-owner-access-rbac`. Earlier sidebar/RBAC commits are already committed on the branch but remain unpushed. GitHub auth/network still block Greptile review. The owner checkout and port 3000 were left untouched.

### 2026-10-10 — Server-side platform route RBAC

- **Changes:** Added a shared server route gate driven by the same explicit role matrix as sidebar visibility. Applied it to platform routes that previously relied only on broad platform membership. Added route matrix entries for tenant suspend/restore and the audit-log alias. Added a test that every registered route remains visible to both platform owner slugs.
- **Verification:** Web typecheck passed; root Node tests passed 42/42; full lint had 0 errors and 11 warnings; focused ESLint passed with an ignored test-file warning; `git diff --check` passed. The app-local Jest script cannot parse Next's TypeScript `--showConfig`; the repo root Node test script is the working suite.
- **Status:** Changes are isolated on `fix/platform-owner-access-rbac`; no authenticated session/browser test, deploy, push, or Greptile review has occurred. Port 3000 and the owner checkout were untouched.

### 2026-10-10 — M1 system health initial surface

- **Changes:** Added `/platform/health`, an all-sub-role read-only route, sidebar link, and reactive Convex query. It reports Convex reachability plus bounded, payload-free WorkOS webhook samples; missing Vercel and uptime integrations are labeled unmonitored.
- **Verification:** Web and direct Convex TypeScript checks passed; root Node suite passed 42/42; focused ESLint passed with one ignored-test-file warning; full lint had 0 errors and 11 existing warnings; `git diff --check` passed.
- **Status:** M1 is partial until external monitoring, authenticated runtime, and deployment verification are available. No provider credentials or payloads are read or returned.

### 2026-10-10 — I2 effective SLA configuration

- **Changes:** SLA read now returns effective targets for all three ticket categories with explicit fallback/override source. Super-admin can configure fallback rows, update overrides, and restore built-in fallback. Support sees targets read-only. Extracted target validation and network-priority rules for tests.
- **Verification:** Web and direct Convex typechecks passed; root Node suite passed 42/42; focused ESLint passed; full lint had 0 errors and 11 warnings; `git diff --check` passed.
- **Status:** I2 remains partial pending authenticated role/runtime and production database verification.

### 2026-10-10 — C5 CSV import hardening

- **Changes:** Reconciliation CSV parsing now has a 1 MB byte cap and 500-row cap, supports BOM/CRLF/quoted values, and rejects malformed quotes, bad headers, missing values, and extra fields before backend mutation. Removed sample payment data from the UI placeholder.
- **Verification:** Parser tests passed; web and Convex TypeScript passed; root suite 42/42; focused ESLint passed; full lint had 0 errors and 11 existing warnings; `git diff --check` passed.
- **Status:** C5 remains partial until authenticated roles and deployed-data behavior are verified.


### 2026-10-10 — E3 commission-rate RBAC correction

- **Changes:** Removed the Ops read overgrant from global commission rate, override, and agency-option queries. The backend now uses the same super-admin/finance role tuple as the page and sidebar. Added a regression test proving spec-silent Ops, support, and readonly roles are excluded.
- **Verification:** Focused commission policy test passed; web and direct Convex typechecks passed; `git diff --check` passed.
- **Status:** E3 configuration CRUD exists but accrual/payout integration and authenticated live-role verification remain open. Changes are committed on the isolated RBAC branch for review; no push or deployment was performed. Owner checkout and port 3000 were untouched.

### 2026-10-10 — B3 RADIUS fleet status re-audit

- **Changes:** Reclassified B3 from absent to partial based on the checked-out platform route, CRUD backend, audit writes, role gates, and read-only UI. The register and production plan now identify telemetry ingestion as the remaining blocker.
- **Verification:** File-grounded route/backend/UI review and `git diff --check` passed. No telemetry integration or authenticated role test was performed.
- **Status:** Awaiting an approved trusted telemetry source; no sample metrics were introduced.


### 2026-10-10 — D1/D2 partner relationship access boundary

- **Changes:** Re-audited agency/reseller registries and lifecycle flows. Replaced an unbounded tenant relationship `.collect()` with `.take(101)` and a fail-closed 100-link limit; added boundary coverage. Updated module status and production-plan evidence.
- **Verification:** Tenant and partner lifecycle tests passed; direct Convex and web typechecks passed; `git diff --check` passed.
- **Status:** Relationship suspension propagates across linked descendants and tenant auth rejects suspended chains. Live authenticated role and deployed cascade verification remain outstanding.


### 2026-10-10 — D1 partner registry RBAC alignment

- **Changes:** Removed readonly from the agency/reseller registry UI readers, matching the canonical spec-silent denial and Convex query. Centralized read and SA-only management helpers and added allow/deny tests for canonical roles and legacy aliases.
- **Verification:** Focused tests passed; web typecheck passed; focused ESLint passed with the expected ignored-test-file warning; `git diff --check` passed.
- **Status:** Authenticated browser/backend role verification remains open. GitHub remains unreachable in this environment; no PR or Greptile review was started.


### 2026-10-10 — G4 platform API-key disclosure review

- **Changes:** Extracted the public API-key row projection and added a test proving list responses omit token digests and creator/revocation identities. Reclassified G4 as partial because the public resource scope is currently only `organizations:read`.
- **Verification:** API-key/role tests passed; direct Convex and web typechecks passed; `git diff --check` passed.
- **Status:** One-time token issuance and digest-only storage exist. Broader endpoint scope, authenticated role verification, and deployed verification remain open.

### 2026-10-11 — Platform owner access and sidebar visibility

- **Scope:** Investigate why restored platform features do not appear for the owner and why role management can be unavailable.
- **Changes:** Added sidebar entries for implemented platform routes and required every menu route to have an explicit central role scope. Added owner visibility and Finance/Ops filtering tests. Made `platform_owner` a recoverable full-access role even when the stored role list or permission array is stale, and made its role grants immutable at the backend and UI.
- **Verification:** Full repository suite passed 239/239; web and targeted Convex TypeScript checks passed; focused frontend ESLint and `git diff --check` passed. The isolated production build stops before compilation because Next.js cannot parse TypeScript `--showConfig` output. Authenticated role behavior and Greptile review remain pending. Port 3000 is already served by the owner checkout, confirmed at `/home/myles/Projects/mylesnet-dashboard/apps/web`; it was not disturbed, so it cannot show this isolated branch before it is integrated.
- **Status:** No authenticated account or browser verification was available. GitHub/Greptile status still needs checking after local gates. Some canonical modules have no implementation page and therefore are not linked as if they existed.

### 2026-10-11 — Canonical super-admin and platform role claims

- **Scope:** Continue RBAC and sidebar corrections for the five canonical platform sub-roles.
- **Changes:** Removed the legacy `platform_admin` role from the super-admin backend mapping, `/platform/access` admin branch, super-admin navigation grants, and management helpers. Added normalization for organization-scoped canonical platform role claims so owner, ops, finance, support, and readonly claims resolve to their stored role equivalents. Added allow/deny regression coverage for owner versus legacy admin and all scoped-role aliases.
- **Verification:** Repository tests passed 45/45; web typecheck and targeted Convex typecheck passed; focused ESLint completed with zero errors and two ignored-test warnings; `git diff --check` passed.
- **Status:** Changes are in the isolated PR worktree; see PR #81. `gh auth status` still reports the saved GitHub token is invalid, so no push or Greptile review can be started from this session. The owner's port 3000 server remains undisturbed and still serves its separate checkout.

### 2026-10-11 — Platform RBAC backend parity

- **Scope:** Apply the canonical five-role matrix to direct platform route and Convex access, not only sidebar/action visibility.
- **Changes:** Removed `platform_admin` and generic `readonly` from platform panel entry and route allowlists. Made owner-only backend helpers owner-only, kept ops and finance checks within their canonical roles, and retained ops fleet market access. Restricted platform staff create/update/delete/restore and invitation writes to the canonical super-admin. Restricted leaderboard reads to super-admin/readonly. Removed legacy admin write/read escalation from feature flags, data requests, the user directory, and corresponding UI gates. Extended organization-scoped role claim normalization for all five role types.
- **Verification:** All 45 repository test files passed; web and targeted Convex TypeScript checks passed; focused ESLint had zero errors with two ignored-test warnings; `git diff --check` passed.
- **Status:** Uncommitted changes are in the isolated PR worktree pending push and Greptile review. GitHub auth remains invalid. Local port 3000 cannot be reached from this execution environment, and no listener was started or stopped. The owner's local UI has not been updated until the reviewed branch is integrated.
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
- Status: local-main C5 failures do not exist on current origin/main and are not current PR baseline failures. Rebased the gate onto `origin/main` so the PR contains one commit and no unrelated history. The rebased branch passed `pnpm typecheck`, `pnpm test` (171/171), `pnpm lint` (zero errors, 15 warnings), and `pnpm build` (131 generated pages). GitHub CI security fails its production dependency audit on unchanged baseline `next` below patched 16.3.8 (GHSA-cjq9-62q9-8jv4); secret scanning passed. Do not change runtime dependencies in this gate PR. Review details: see PR #73.


### 2026-10-10 - Greptile review

- Review record: see PR #73.

### 2026-10-10 — Shared landing and panel design tokens

- **Scope:** Align the public landing page and shared workspace, Platform, Admin, Reseller, and Partner panels on one light/dark semantic and component-token system.
- **Changes:** Added shared page gutter and card shape, border, padding, gap, and elevation tokens; made workspace and landing cards consume them; moved landing fonts back to the existing shared font tokens; aligned landing content width to the documented 1140px token; made native controls follow the resolved light/dark scheme; extended typed token references and token-check guards; corrected source paths and updated repository and canonical vault token documentation.
- **Verification:** Design-token check, full web TypeScript check, and `git diff --check` passed. ESLint completed with zero errors and 15 existing warnings. Production build was blocked by the isolated worktree's dependency symlinks: Turbopack rejects links outside the worktree and the webpack fallback could not parse TypeScript's config output. Browser visual review could not run because the sandbox denied binding the local dev server port.
- **Status:** Changes are in isolated branch `feat/unified-design-system` at `/home/myles/Work/mylesnet-design-system`. The source checkout's existing uncommitted changes remain untouched. The vault work-log entry is synchronized.

### 2026-10-10 — Greptile review

- Review record: see PR #77.

### 2026-10-13 - Unified token rollout and shared templates

- **Scope:** Continue the MylesNet app-shell and design-token implementation; Linear is excluded per owner instruction.
- **Changes:** Installed the supplied token JSON as the canonical source in the repo and vault, synchronized token CSS and Tailwind mappings, documented the permanent token rule in root `AGENTS.md`, removed active docs that described the retired palette, and added reusable list, form, and detail page frames.
- **Verification:** Web typecheck passed. `pnpm test` passed 28/28. Lint passed with 15 warnings and no errors. Token check and `git diff --check` passed. Web Jest still fails before test discovery because Next cannot parse TypeScript `--showConfig`. Production build stalled at compilation without output and was stopped.
- **Status:** Work continues. Payment-backed Overview metrics await explicit approval. Additional panel content, visual checks, release checks, and production deployment remain outstanding.

### 2026-10-10 - Tenant panel end-to-end program kickoff

- **Scope:** Start the long-horizon program to make the tenant panel satisfy the full P1/P2/P3 list in `docs/tenant-panel-feature-list.md`.
- **Changes:** Copied the feature list into the repo at `docs/tenant-panel-feature-list.md`; ran a repo-evidence audit of every feature ID and wrote `docs/tenant-panel-audit.md`; wrote program goal records `docs/goal/goal.md`, `progress.md`, `decisions.md`, `blockers.md`, and `lessons.md`.
- **Verification:** Baseline gates on the isolated worktree are clean: `pnpm typecheck` passes and `pnpm test` passes 171/171. The owner checkout was left untouched.
- **Status:** Audit complete. The tenant panel is a narrow billing and operations workspace; the large majority of features are Partial or Missing. Foundation defects to fix first: `logAudit` writes no `tenantId` (tenant audit log returns empty) and `analytics`, `scheduledReports`, and `notifications` are not tenant-scoped. Production deploy and live verification are blocked on an approved production Convex target/credential and a real test tenant. Work runs in the isolated worktree `/home/myles/Projects/mylesnet-tenant-panel` on `feat/tenant-panel-program`.

## 2026-10-11 continuation — complete panel role-entry parity

Added concrete `ops_manager` and `finance_manager` system roles to server panel-entry checks and panel selection so the backend identities produced by organization-scoped claims can enter Platform. Tightened the legacy `platform_admin` boundary in global ticket management and RADIUS connection-detail projections. Regression suite passes 262 tests across 45 files; `pnpm typecheck` and targeted Convex typecheck pass; `pnpm lint` has zero errors and 11 unrelated unused-variable warnings. Production build remains blocked by Turbopack worker socket `EPERM`; webpack fallback cannot parse TypeScript `--showConfig`. `gh auth status` reports an invalid token and GitHub API DNS resolution fails, so PR #81 has not received these fixes and no new Greptile review was possible. Port 3000 was not started or disturbed. See PR #81.

## 2026-10-11 continuation - sidebar alias matrix regression

Added exhaustive parity coverage requiring every registered sidebar route to produce the same allow or deny result for each canonical platform sub-role and its stored or WorkOS organization-scoped role aliases. The focused RBAC tests and full 45-file repository suite pass. Clarification: the runner reports 45 top-level test-file jobs, not a stable count of leaf assertions; use the file-level result rather than the earlier 262 figure. Greptile review remains unavailable until the local commit can be pushed to PR #81.

### 2026-10-11 - Platform access review follow-up

- **Scope:** Remediate security and authorization gaps found on the platform access/sidebar review; follow-up work is isolated from PR #81 after its review-round stop condition.
- **Changes:** Replaced broad platform-membership reads with canonical sub-role gates for cross-tenant user, tenant, and policy-template queries; kept membership access overrides until a timestamped provider event confirms the requested state; audited sync/backfill mutations and made failed subscriber-count scans release their write-blocking flag; restored tenant-scoped commissions access and cursor pagination; removed internal implementation details from screen copy; corrected the D1 role test to deny spec-silent readonly access. See PR #81 for review context.
- **Verification:** `pnpm test` passes 45/45 test-file jobs; web typecheck and targeted Convex typecheck pass; lint has zero errors and 11 existing warnings. On clean `origin/main` (`afcdcb0`), typecheck and tests pass and lint has zero errors with 15 warnings. The webpack build reaches the same environment-configuration failure on baseline and follow-up; the default Turbopack build is blocked in this worktree by worker-port `EPERM`.
- **Status:** Follow-up branch is not yet integrated. Authenticated role-by-role runtime verification and the integrated port-3000 app remain outstanding. The owner's port-3000 listener was not accessed or disturbed.

### 2026-10-11 — Platform access review findings follow-up

- **Scope:** Fix the valid commission-pagination and subscriber-count backfill concurrency findings raised during review of the platform RBAC follow-up.
- **Changes:** Commission status filtering now uses tenant/status indexes before pagination and permits only the specified platform super-admin, finance, and ops roles for cross-tenant views. Backfill start atomically claims the running flag before scheduling, preventing duplicate starts.
- **Verification:** Web typecheck, targeted Convex typecheck, all 45 test-file jobs, and lint with zero errors passed. Lint reports 11 unrelated warnings. Production build remains blocked by worker-port `EPERM`; the webpack fallback cannot parse TypeScript `--showConfig` in this isolated worktree.
- **Status:** Changes are on the separate review-fix branch. See PR #84. The owner checkout and port 3000 listener remain untouched.

### 2026-10-12 — Tenant read isolation merged (Foundation)

- **Scope:** Land tenant isolation for analytics, report definitions, export history, generated reports, and the ownership backfill.
- **Changes:** Gated cross-tenant reads behind the active tenant and explicit platform sub-roles; added `canReadTenantReports` and `requireReportExportActor` so a scheduled export authorizes its creator before reading data or storing a file and drops the stored artifact if the writer still rejects; audited every ownership change and export write; bounded the backfill's per-batch and per-agent reads.
- **Verification:** Web typecheck clean; repository `node --test` 206/206; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except 4 baseline test-file errors identical at `origin/main`; `next build` passed using a non-secret placeholder for the Convex URL variable.
- **Status:** Merged at `81a1803`. See PR #80.

### 2026-10-12 — Payment recording idempotency (Foundation)

- **Scope:** Make recording the same tenant payment twice a no-op.
- **Changes:** `payments.create` returns the existing payment when `(tenantId, gateway, reference)` already exists; `payments.update` normalizes the stored pair and rejects a key collision with another payment in the tenant; the create lookup falls back to the raw key so a row written before normalization still matches its retry; added the `by_tenant_gateway_reference` index and a pure `paymentIdempotencyCore` with duplicate-detection/tenant-scope tests.
- **Verification:** Web typecheck clean; repository `node --test` 214/214; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except 4 baseline test-file errors identical at `origin/main`; `next build` passed using a non-secret placeholder for the Convex URL variable.
- **Status:** Merged at `2d00cca`. See PR #92.

### 2026-10-13 — Platform MFA policy enforced (Phase 0)

- **Scope:** Reconcile the platform MFA policy to the owner-fixed decision (mandatory for every platform role) and make it the single approved source.
- **Changes:** `convex/lib/mfa.ts` derives the mandatory set from the role registry (`SYSTEM_ROLES` entries with `isPlatform: true`), so every platform role — `platform_owner`, `platform_admin`, `member`, `ops_manager`, `finance_manager`, `market_manager`, `investor_viewer`, `platform_support`, `platform_readonly` — requires MFA and fails closed when unenrolled, while no-opping for users with no mandatory platform role; an explicit `mfaEnrolled: false` denies even with a stale `mfaEnrolledAt`. `convex/lib/auth.ts` enforces it in every platform authorization gate (`requirePlatformUser`, `requirePlatformAdmin`, `requirePlatformOwner`, `requireAnyRole`, `requireOpsOrAbove`, `requireFinanceOrAbove`, `requireInvestorViewer`, the platform branch of `requirePermission`, `requirePlatformSubRole`, `requirePlatformSubRoleForUser`); `scheduledReports.canReadPlatformReports` and the platform branch of `scheduledReports.requireReportExportActor` check it for the platform-wide (cross-tenant) report path, while tenant-scoped report reads and exports are unchanged; `convex/platformUsers.syncWorkosIdentity` clears the timestamp when WorkOS reports the factor removed. `docs/auth/README.md` records the MFA position and the fixed session policy (30-minute inactivity, 25-minute warning, 12-hour absolute); `docs/decisions.md` and `docs/development/work-log.md` record the decision. Tenant-facing handlers are unchanged.
- **Verification:** Web typecheck clean; repository `node --test` 216/216; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except 4 baseline test-file errors identical at `origin/main`; `next build` passed using a non-secret placeholder for the Convex URL variable.
- **Status:** Branch `feat/platform-mfa-policy`, PR #93 open with CI and Greptile review pending (first review raised three P1 security findings — incomplete platform-role coverage, removed-factor persistence, and the report-export bypass — all addressed on the next head). Review record: `products/mylesnet/greptile-review/pr-93-platform-mandatory-mfa.md`. Session enforcement code is the next Phase 0 task.

### 2026-10-13 — Platform session policy enforced (Phase 0)

- **Scope:** Implement and prove the session policy fixed with the mandatory-MFA decision — 30-minute inactivity timeout, 25-minute warning, 12-hour absolute lifetime — without weakening the MFA rules.
- **Changes:** Added one policy source, `apps/web/shared/auth/sessionPolicy.ts` (`PLATFORM_SESSION_POLICY`) with pure evaluators (`evaluatePlatformSession`, `latestTimestamp`, `parseStoredTimestamp`, activity/start-storage keys, `remainingMinutesLabel`). Server half: `requirePanelAccess` now returns the `AuthSession`; `apps/web/shared/auth/platformSession.ts` compares the WorkOS `auth_time` to the 12-hour cap and the platform layout redirects to the new `/sign-out` route (`apps/web/shared/auth/routes/sign-out.ts` + thin `app/(panels)/sign-out/route.ts` stub), which ends the WorkOS session and returns to sign-in. Browser half: `SessionGuard` is mounted only by the platform layout, warns at 25 minutes, signs out at 30, enforces the cap in-page, shares activity across tabs through `localStorage` keyed by the `sessionId`, and keeps `Date.now()`/timers out of the render path. Review hardening: a page load counts as activity only while the stored activity is still inside the policy window, activity arriving after the window closes ends the session instead of extending it, a failed sign-out clears the in-flight flag and retries, and the expiry notice is a real modal (portalled, focus moved to its sign-in action, Tab trapped, background hidden from assistive technology and made inert) whose action is `/sign-out`. Notice styles use existing tokens; copy uses product language only. No new runtime dependency; no Convex schema, index, or function change; tenant-panel behavior is unchanged.
- **Verification:** Web typecheck clean; repository `node --test` 229/229 (13 new `sessionPolicy` cases); web jest 25/25 (10 new `SessionGuard` cases); lint zero errors (14 pre-existing warnings outside the diff); design-token check; `next build` passed using a non-secret Convex URL placeholder (the `/sign-out` route builds). Review history: vault `greptile-review/pr-95-platform-session-policy.md`.
- **Status:** Merged at `9c5c549` (squash). See PR #95. Production deploy remains blocked by B-001 (no approved production Convex target/credential).

### 2026-10-13 — Legacy route no-deletion audit re-baselined (Phase 1)

- **Scope:** Re-baseline the separate no-deletion audit that must precede the platform app-boundary work, and make it enforceable. The earlier audit lived only on unmerged production branches whose `apps/admin` tree is absent from `main`.
- **Changes:** Added `docs/audits/legacy-route-no-deletion-audit-2026-10-13.md`, a status-only inventory of the `/admin`, `/agency`, `/reseller`, and `/partner` panel roots and the tenant business-reporting and finance routes (implementation module, evidenced backend dependencies, references, verification limits, migration gate). Added `scripts/audit/legacy-route-no-deletion.test.mjs`, which strips comments and fails when an audited facade or implementation disappears or a facade stops actively loading the audited module; the `/analytics` alias must remain the active redirect to `/insights/analytics`. Included `scripts/audit/*.test.mjs` in the repository test job in `package.json`. No runtime, schema, or UI behavior changed.
- **Verification:** Repository `node --test` 234/234 (5 new guard cases); the guard was negative-tested (removing a facade, or commenting out its re-export, fails the guard); lint zero errors (14 pre-existing warnings outside the diff); web typecheck; design-token check.
- **Status:** Merged at `b7123db`. See PR #97.

### 2026-10-13 — Platform role matrix single-sourced and proven on server and UI (Phase 0)

- **Scope:** Close the Phase 0 "role matrix is documented and enforced on server and UI" gap by giving the platform access matrix one source and proving the panel UI agrees with the Convex gates.
- **Changes:** Added `convex/lib/platformAccess.ts`, the canonical platform gate matrix (read, operate, finance, revenue-read, voucher-monitor, fleet-read, analytics-read, and super-admin sub-role lists). Every Convex platform gate that previously repeated a sub-role array now imports its list from that module (`tenantControl.ts`, `provisioning.ts`, `platformPlans.ts`, `platformMarkets.ts`, `platformRevenue.ts`, `scheduledReports.ts`, `voucherFraud.ts`, `tenantMigrations.ts`, `fleet.ts`, `markets.ts`, `featureFlags.ts`, `analytics.ts`), so access is declared once and resolved through the real `PLATFORM_SUB_ROLE_MAP`. Added `apps/web/platform/permissions.test.ts`, which imports those lists, resolves them through the same map, and asserts the panel visibility helpers (`canManagePlatformTenants`, `canManagePlatformPlans`, `canDeletePlatformTenant`) agree for every concrete platform system role; a backend gate change now flows into the guard instead of escaping a copied matrix. The guard also proves the helpers fail closed with no roles and that no gate resolves to a non-platform role. `package.json` now includes `apps/web/platform/*.test.ts` in the repository test job. The gate lists are behavior-preserving; no Convex schema, session, or UI-runtime change.
- **Verification:** Repository `node --test` 242/242 (+8 parity cases); web jest 25/25; web typecheck; lint zero errors (14 pre-existing warnings outside the diff); convex-tree `tsc` clean except the 4 baseline test-file errors identical at `origin/main`; design-token check; `next build` passed using a non-secret Convex URL placeholder.
- **Status:** Merged at `f9695f9` (squash). See PR #99.

### 2026-10-13 — Additive `apps/admin` platform app boundary (Phase 0/1)

- **Scope:** Start the separately deployable platform control plane required by the owner directive without removing or redirecting any legacy surface, and gate it with a test so the two live deployments cannot drift.
- **Changes:** Added `apps/admin`, a separate Next.js app that serves the platform control plane (`/platform`) plus the auth routes the panel needs (`/auth/callback`, `/signin`, `/sign-out`, `/login`, `/password-reset`, `/invite`, `/no-access`) and the safe `error.tsx`/`global-error.tsx` boundaries. The shipped platform route tree (23 `page.tsx` entries plus the platform layout) is mirrored byte-for-byte, while the panel implementation (`apps/web/platform`) and the shared runtime (`apps/web/shared`, the `convex` backend) are consumed through `tsconfig.json` path aliases rather than copied, so authorization and session behavior cannot diverge between `apps/web` and `apps/admin`. `apps/admin/app/globals.css` reuses the web token/shell stylesheet through a relative `@import` and declares the reused Tailwind sources with `@source`; without those directives Tailwind does not scan the reused trees and panel/UI-kit utilities are silently dropped. Added `scripts/audit/admin-platform-boundary.test.mjs`: route-tree parity, byte-identical mirrored routes/layouts/proxy, required assets, alias shape, `@source`-resolves checks, and a `walkFiles` nested-path case. Root `build`/`lint`/`typecheck` now cover `@mylesnet/admin`; CodeQL scans `apps/admin`; `docs/architecture/repository-map.md` records the new deployment boundary. `apps/web` is unchanged and still ships `/platform`.
- **Verification:** Repository `node --test` 249/249 (+7 boundary cases); web jest 25/25; web + admin typecheck; lint zero errors (14 pre-existing warnings outside the diff); design-token check; web + admin production build with a non-secret Convex URL placeholder (admin emits all 23 `/platform` routes plus the auth routes and detects the proxy).
- **Status:** Merged at `3cdce01` (squash). See PR #101. Review record: `products/mylesnet/greptile-review/pr-101-admin-app-boundary.md`. Production deploy remains blocked by B-001.

### 2026-10-13 — Greptile 5/5 gate hardened to reject unclean reviews

- **Scope:** Close the gap that let a below-5/5 review merge. Greptile completes its `Greptile Review` check with a `success` conclusion even when it opens findings, and the gate read only that conclusion, so a 4/5 review (for example "2 files reviewed, 2 comments added") still showed the `Greptile 5/5` check as green.
- **Changes:** `.github/scripts/verify-greptile-five-of-five.mjs` now parses the findings count Greptile reports in its review summary ("N comments added", scanning both `output.summary` and `output.text`) and adds `getGreptileGateResult`: pass only when the head's review completed successfully with 0 comments; fail when it completed successfully but opened comments; fail closed (`unverifiable`) when the summary reports no count so 5/5 can never be assumed from a successful check-run alone. The existing conclusion-only helper is unchanged, and the workflow keeps its trigger and permissions and now uses the composite result.
- **Verification:** `scripts/verify-greptile-five-of-five.test.mjs` gains cases for a clean pass, a comments-added failure, a text-only count, summary precedence when both fields report a count, fail-closed on a missing count, pending states, and newest-run handling; repository `node --test` 258/258; lint zero errors (14 pre-existing warnings outside the diff). No runtime, schema, or UI change.
- **Status:** Merged at `70bb798` (squash). See PR #104.
