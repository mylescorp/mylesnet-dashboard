# Build decisions

## Landing-surface consistency correction (2026-09-13)

- **Token alias repair:** shadcn/Tailwind aliases are isolated behind `--ui-*` and `--color-*` mappings. The earlier implementation overwrote semantic `--primary`, `--muted`, and `--accent` values, producing low-contrast public navigation and copy. Product semantic tokens are now never shadowed by primitive aliases.
- **Responsive review:** desktop navigation exposes only desktop links and the primary CTA; the Sheet trigger is restricted to the mobile breakpoint. The hero grid was replaced by a constrained block flow to prevent intrinsic-content clipping on narrow screens.
- **Shared-surface cleanup:** public cards, banners, CTAs, pricing, footer, and preview bars consume the approved token scale. Landing TSX no longer has inline presentation styles.

## Landing-surface Phase 2 — Primitives and shared components (2026-09-12)

- **shadcn primitives added:** Button, Sheet, Badge, Card, Select (5 primitives total). Justification: Button for CTAs, Sheet for mobile navigation (Radix focus management), Badge for status chips, Card for footer structure, Select for currency switcher.
- **Header.tsx migrated:** Replaced custom mobile menu with Radix Sheet, added active-link state via `usePathname` and `aria-current`, imported shadcn Button and Sheet components.
- **StatusChip.tsx migrated:** Replaced landing.css status chip classes with shadcn Badge component (default/secondary/outline variants for Available/Beta/Planned/Custom).
- **PricingPlans.tsx migrated:** Replaced custom segmented control with shadcn Select component for currency switcher, replaced landing-cta-button with shadcn Button.
- **Footer.tsx:** Kept as-is (Card not needed — footer structure uses existing landing.css layout).
- **landing.css deletions:** Removed button styles (46 lines), nav-toggle/mobile-menu styles (26 lines), status chip styles (49 lines), pricing switch styles (53 lines), responsive overrides (9 lines). Total: ~183 lines deleted.
- **landing.css retained:** .landing-cta-button kept for page-level CTA band usage (31 lines), .landing-secondary-button kept for future use, .landing-nav-link kept for desktop nav, .landing-plan-card kept for pricing cards, .landing-preview-* kept for ProductPreview.
- **Line count delta:** landing.css reduced from 2,919 lines to 2,746 lines (173 lines deleted).
- **Packages added:** class-variance-authority ^0.7.1 (for shadcn variant system), @radix-ui/react-sheet (Sheet primitive), @radix-ui/react-select (Select primitive).
- **Technology stack updated:** Added class-variance-authority and @radix-ui/react-sheet to docs/technology-stack.md.

## Landing-surface design contract — Network Pulse direction (2026-09-12)

- **Visual direction selected:** "Network Pulse" — warm orange connectivity glow with data-driven precision, an evolution of the current orange/navy with glassmorphism elevation.
- **Token contract extended (v2.2):** Added landing-surface tokens to `docs/design/tokens.md`:
  - Display type scale (`--landing-display-xs` to `--landing-display-xl`) with `clamp()`-driven responsive sizing
  - Font display token (`--landing-font-display`) for Space Grotesk
  - Section padding tokens (`--landing-section-padding-sm/md/lg`) for vertical rhythm
  - Container width (`--landing-container: 1140px`)
  - Glass surface tokens (`--landing-glass`, `--landing-glass-border`) with dark-mode opacity adjustments
  - Glow tokens (`--landing-primary-glow`, `--landing-accent-glow`) for decorative effects
  - Surface tint (`--landing-surface-tint`) for emphasis backgrounds
  - Connectivity line (`--landing-connectivity-line`) for gradient line motifs
  - Data strip tokens (`--landing-data-strip-bg`, `--landing-data-strip-line`) for telemetry-style bars
- **Dark mode plumbing for landing:** Added no-flash theme script to `app/(landing)/layout.tsx` using existing ThemeToggle mechanism (localStorage + `prefers-color-scheme`).
- **shadcn/ui initialized:** Created `components.json` at `apps/web` with Tailwind v4 CSS-variable theming wired to MylesNet semantic tokens (no separate shadcn palette). Added `clsx` and `tailwind-merge` packages for the `cn()` utility.
- **CSS variable mapping:** Added shadcn variable mapping in `app/globals.css` (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`) to resolve to MylesNet semantic tokens in both light and dark modes.
- **Technology stack updated:** Added clsx and tailwind-merge to `docs/technology-stack.md` as foundation packages (2026-09-12 landing-surface design contract).
- **Landing design record expanded:** Updated `docs/design/landing.md` with Network Pulse direction details, page archetypes, component mapping to shadcn primitives, dark mode plan, motion rules, and landing.css deprecation path.
- **Font loading refined:** Space Grotesk font loading in `app/layout.tsx` supports both `--font-space-grotesk` (variable) and `--font-landing-display` (display usage) tokens.

## Master Admin (`/platform`) — build log

> **2026-09-05 snapshot:** the two chrome surfaces described below (network-ops
> shell vs `/platform` panel) have been **consolidated into one unified system**.
> The `/platform/*` URL prefix was flattened with permanent redirects, all pages
> moved to the app root, and one role-aware sidebar/topbar/dashboard now serves
> every role. Historical rulings from the build remain recorded verbatim below.

Decisions recorded for the integration of the Master Admin panel into the
existing MylesNet network-operations dashboard. These complement the earlier
planning notes; only build-time rulings are recorded here.

### Layout / routing

- **Single panel, not a separate tenant app.** All Master Admin UI lives under
  `app/platform/` in the existing Next app. There is no separate "Super Admin"
  app. Naming stays `platform` / `admin` / `dashboard` only.
- **Route guard is a layout guard, not a middleware change.** `middleware.ts`
  already gates every route except `/signin`. Per the agreed decision, the
  global middleware is left unchanged. The `app/platform/layout.tsx` shell
  (client `PlatformShell`) calls `api.platform.getCurrentPlatformUser`:
  - `null` (unsigned) → redirect to `/signin`
  - non-platform user → redirect to `/platform/unauthorized`
  - platform user → render the panel
- **Operations chrome is bypassed for `/platform/*`.** `AppShell.tsx` returns
  bare `{children}` for paths starting `/platform`, so the platform layout owns
  its own dark sidebar + topbar instead of rendering under the network-ops shell.

### Auth / RBAC

- Roles: `platform_owner` (Myles, everything), `platform_admin` (day-to-day,
  cannot self-approve payouts or manage admins), `platform_support`
  (read-only + tickets), `agent` (client-facing, `/dashboard` only).
  Enforcement lives in `convex/lib/auth.ts` (`requirePlatformUser`,
  `requirePlatformAdmin`, `requirePlatformOwner`, `assertNotSelfApproval`).
- **Owner bootstrap is one-shot.** `claimPlatformOwner` permanently refuses once
  any `platform_owner` row exists. This is the only standing privilege-escalation
  path and is surfaced on the dashboard as a first-run banner.
- **Self-approval rule.** An admin cannot approve a commission payout they
  requested; only `platform_owner` is exempt (`assertNotSelfApproval`).

### Schema

- Business tables were **merged into the existing `convex/schema.ts`** (not a
  separate schema). `authTables` are preserved via `...restAuthTables`; the
  `users` table is redefined with `platformRole` + `by_platformRole` index.
- `routers.marketId` added as an optional link to the business layer.
- Every mutating action goes through `logAudit` (`convex/lib/auditLog.ts`) into
  the unified `auditLog` table.

### Lifecycle / soft-delete semantics

- Markets: `status` active/suspended/deleted + `lifecycleStatus`
  planned/active/paused/decommissioned. Soft delete refuses when active devices
  or active agent assignments exist unless `forceCascade` is chosen explicitly.
- Devices: `lifecycleStatus` active/maintenance/suspended/deleted. Hardware
  swaps never overwrite the record — they append to `deviceReplacementEvents`
  and move the device to maintenance so alerting stops.
- Agents: `lifecycleStatus` active/suspended/terminated. Offboarding is a
  multi-step wizard wired to the standard commission approval flow for the final
  settlement. Restore never rewrites financial history.
- Trash is a single read-only aggregation (`convex/trash.ts`) across
  markets/devices/agents with per-entity restore.

### Vouchers & commissions

- Voucher codes carry a mod-97 checksum so guessed/tampered codes are rejected
  without a DB lookup.
- Customer phone is captured **only** at redemption (the sole customer PII
  field), enabling the Centipid weekly CSV reconciliation. If Centipid's export
  lacks a matching identifier, `renewalCredits` simply never populates — the UI
  must show "unavailable — pending Centipid data", never a false zero.
- Commission pipeline: `held` (dispute window, 30 days) → `requested` →
  `approved` → `processing` → `paid`, with `disputed` as owner-only. Payout
  request is blocked until the dispute window closes.
- `sweepExpiredVouchers` runs on a schedule via `convex/crons.ts` (daily); the
  schedule itself must still be manually verified against the live deployment
  before relying on it.

### Centipid billing integration (2026-09-04)

- **Two developer surfaces.** (1) MCP API token against
  `https://mcp.centipidbilling.com/mcp` for read-only access; (2) signed
  outbound webhooks for 9 events (`subscriber.created|paused|resumed`,
  `payment.received|refunded`, `voucher.generated|redeemed`,
  `ticket.opened|resolved`) delivered to `/receiveCentipidWebhook`.
- **Credentials are encrypted at rest.** Both the API token and webhook signing
  secret are AES-256-GCM encrypted (`convex/lib/centipidCredentials.ts`) under
  `CENTIPID_CREDENTIALS_ENCRYPTION_KEY` (base64 32-byte, generated like
  `ROUTER_CREDENTIALS_ENCRYPTION_KEY`) before persisting in
  `centipidCredentials`. They are entered via the Centipid settings page
  (`app/centipid`), never committed. The opencode MCP client reads its own
  `CENTIPID_MCP_TOKEN` from the **shell environment** at launch
  (`{env:CENTIPID_MCP_TOKEN}` header interpolation — opencode does not read
  `.env.local`), so the operator sets it once in their profile before starting
  opencode.
- **Two-phase webhook rollout.** The signing scheme is not publicly documented,
  so the receiver starts in **capture mode**: every delivery is acknowledged
  (HTTP 200) and its raw signature header + body preview logged to
  `webhookDeliveryLog`, but no events are written. Once credentials are saved it
  switches to **live mode**: raw-body HMAC-SHA256 verification
  (`convex/lib/centipidVerify.ts`), then per-category storage with dedupe on
  `webhookEventId` (fallback: id + event type + timestamp). A real signed
  delivery must be captured to pin the exact header/input/payload contract
  before live mode can be trusted with production traffic.
- **Retention.** `webhookDeliveryLog` rows are deleted after 30 days and the
  subscriber raw payload preview wiped at the same horizon; all event tables and
  their projection rows (`latestSubscriberState`, `ticketStatus`) are pruned
  after 24 months (`pruneCentipidData`, daily cron).
- **KPIs roll by the viewer's local day.** The client passes
  `tzOffsetMinutes`; the server derives today/7d windows from it. Revenue is
  hidden from `agent` roles (`revenueVisible`), consistent with the platform
  dashboard.
- **MCP backfill is best-effort seed only.** `fetchHistoricalCentipidData` reads
  read-only tools (`list_subscribers`, `payments_report`, `voucher_stock`,
  `open_tickets`) and treats webhooks as the source of truth. The 3
  approval-gated tools (`reconnect_subscriber`, `disconnect_no_expiry`,
  `apply_mikrotik_fix`) are intentionally never called.
- **Toggle.** `saveCentipidCredentials` / `setCentipidIngestionPaused` let an
  admin pause ingestion; paused mode acknowledges and logs deliveries but stores
  nothing. Failures never throw out of the HTTP route (200/400/401/500 only).
- **Tests.** `convex/lib/centipidVerify.test.ts` and
  `centipidCredentials.test.ts` run under node:test (`npm test`).

### Identified as unbuilt / deferred

- **Schema deployed to local dev deployment (2026-09-03).** `npx convex dev`
  accepted the "Y" upgrade prompt, upgraded to a new Convex backend version,
  pushed all table indexes, and confirmed "Convex functions ready!" with zero
  schema errors. The dev server was left running at `127.0.0.1:3210`.
- **Support tickets** are schema-only (`supportTickets`); no UI yet.
- **Profiles & Prospects** have no UI yet.
- `renewalCredits` / `leaderboardSnapshots` have no write path yet (Centipid
  reconciliation + gamification surfaced later).
- **Offboarding step "revoke session / clear cookies"** is documented in
  `offboardAgentFinalize` as an HTTP-layer follow-up (Convex cannot touch
  cookies); not yet implemented.

### Unified system consolidation (2026-09-05)

- **One chrome, one nav.** The separate `/platform` shell (dark `PlatformShell`
  + `PlatformSidebar`) is deleted. `app/components/nav.ts` is the single nav
  source of truth (`navSections`, `effectiveRole`, `canAccess`,
  `findNavEntry`) used by `Sidebar.tsx` (role-filtered tree),
  `UnifiedTopbar.tsx` (breadcrumb via `findNavEntry`), `UnifiedShell.tsx`
  (client role guard → `/no-access`; one-shot owner-claim banner now only on
  `/dashboard`) and `UserProfileDropdown.tsx`.
- **URLs flattened with redirects.** `app/platform/{markets,prospects,devices,
  agents,vouchers,commissions,tickets,comms,leaderboard,trash,audit-log,access,
  compliance}` → app root; `platform/components/ui.tsx` → `app/components/ui.tsx`;
  `platform/unauthorized` → `app/no-access`. `next.config.ts` adds permanent
  redirects for every old `/platform/*` path (`/platform` → `/dashboard`,
  `/platform/alerts` → `/incidents`). No `/platform` references remain in app code.
- **Role tiers drive navigation** (owner/admin everything; support read-only +
  tickets + desk + monitoring; operator network ops; agent dashboard + business
  events + tickets; `/compliance` all roles; `/access` owner only).
  **Server remains authoritative** — `convex/lib/auth.ts` guards are unchanged.
  Note: `requireNetworkOperator` aliases `requirePlatformUser`, so a user with
  no `platformRole` cannot actually reach ops endpoints today; the nav's
  "operator" tier is therefore only reachable for endpoints guarded by
  `requireAuthenticatedUser`. Could be revisited if a real operator tier is
  wanted.
- **One dashboard.** `app/dashboard/page.tsx` merges the network overview
  (collector/AP KPIs, health strip, per-router sections) with the platform
  dashboard: `BillingKpiStrip` (new shared component, also used by
  `/business-activity`) plus an `AdminOverviewSection` (open alerts, active
  markets, pending offboard, commissions awaiting approval, action items, quick
  links) mounted only for platform roles. Revenue stays hidden for agents via
  the existing Centipid `revenueVisible` flag.
- **Shared config watch.** `app/components/router/ConfigWatchPanel.tsx`
  (baseline capture, drift check, history, latest snapshot JSON) backs both the
  router console Configuration tab and `/config-watch`.
- **Unified incident & alert desk.** `app/incidents/page.tsx` aggregates
  incidents (`api.incidents`) and root-cause device alerts (`api.alerts`) with
  separate tables, an open/all filter, ack/resolve in shared styling. Alert
  ack/resolve buttons only render for owner/admin (server requires admin);
  incident creation is hidden from support.
- **Devices de-scoped.** The RouterOS estate echo table was removed from
  `/devices`; the module now links to `/routers`. RouterOS estate, config watch,
  collector setup and telemetry health all live under Network Operations.
- **Known follow-ups:** support role cannot ack/resolve alerts server-side
  (`requirePlatformAdmin`); an actual `operator` tier does not exist in Convex;
  `sweepExpiredVouchers` schedule still needs validation against the live
  deployment.

## Network console + AP inventory hardening — build log

> **2026-09-05:** Console index, first-class switch records, and richer access
> point fields. Backend (`convex/`) shipped first so `convex codegen` types the
> new module; UI landed after. `npm run lint` + `npm run build` green; `/console`
> is static-prerendered.

- **Console entry in the sidebar.** `app/components/nav.ts` adds
  `{ href: "/console", label: "Console", icon: Monitor, roles: OPERATOR+PLATFORM }`
  under "Routers & Network", between "Router estate" and "Router console".
- **Network console page.** `app/console/page.tsx` is a client page that queries
  `api.dashboard.getRouterDashboard` (no-arg = all routers) plus
  `api.routers.getOnboardingStatuses`, `api.accessPoints.listAccessPoints` and
  `api.networkSwitches.listSwitches`. Renders a KPI strip (routers, online
  users, APs, switches, collector reach) and one card per router with CPU/mem
  utilization, live-user count, last-telemetry age, AP and switch counts.
  Mirroring existing pages, it guards on `currentUser.isPlatform` and shows an
  "Access restricted" page otherwise.
- **Switch registry.** New `networkSwitches` table in `convex/schema.ts`
  (`routerId, name, model, serialNumber, macAddress, ipAddress, routerPort,
  portCount, managed, note, createdAt/updatedAt, archivedAt/By, archiveReason`,
  index `by_router`) and `convex/networkSwitches.ts` (`listSwitches`,
  `addSwitch`, `updateSwitch`, `archiveSwitch`, `deleteSwitch`). Reads
  `requireNetworkOperator`, writes `requirePlatformAdmin`, audit-logged with
  `entityTable: "networkSwitches"`.
- **AP ↔ switch link.** `accessPoints` gains `switchId` (→ `networkSwitches`)
  and `switchPort`. `addAccessPoint`/`updateAccessPoint` enforce ownership via
  `assertSwitchForRouter` — a switch must belong to the same router as the AP.
  `deleteSwitch` clears `switchId`/`switchPort` on linked APs; `archiveRouter`
  archives the router's switches too ("lifecycle everywhere", matching the
  existing `routers`/`accessPoints` conventions).
- **New AP fields + validation.** `networkAddress`, `ipAddress`, `macAddress`,
  `serialNumber`, `model`, `note`. MAC normalized to uppercase with regex
  `^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$`; IPv4 checked octet-by-octet;
  optional strings cleaned via `optionalClean`. Field semantics follow user
  guidance: `networkAddress` is the *subnet* the AP belongs to (dropdown);
  `ipAddress` is the AP's management IP.
- **Editors** (`app/components/router/RouterEditors.tsx`). `PortSelect` lists
  interfaces live via `api.routeros.getInterfaces` with a cached fallback from
  `api.operations.getRouterTelemetryLatest` (ethernet ports + wifi radios) and a
  "Custom value" escape hatch; `NetworkAddressField` lists the router's live
  subnets via `api.routeros.getIpAddresses` with the same fallback pattern;
  router options for both are fetched per router, so each dropdown only shows
  that router's own ports/networks. `ApEditor` is sectioned (Identity / Network
  / Switch / Service & limits / Note) and `SwitchEditor` handles the registry.
  Both combo boxes defer their mount-time auto-refresh with `setTimeout(0)`
  because the repo lint (`react-hooks/set-state-in-effect`) forbids synchronous
  `setState` inside an effect body.
- **Router console tabs.** `app/routers/[routerId]/page.tsx` gains a "Switches"
  tab (name/model/serial/MAC/IP/router port/port count/linked-AP count, add/edit/
  archive) and the Access points tab now shows IP/MAC/network/model/serial and
  the linked switch (name + port) per AP.
- **Router estate chips.** `app/routers/page.tsx` adds AP chips for the new
  fields (IP, MAC, serial, model, network, switch name·port) and a switch count
  stat per router card.
## Runtime troubleshooting runbook (2026-09-05)

Reported: router username/password would not save when editing a router; and
the browser console showed generic "Server Error" for
`CONVEX Q(networkSwitches:listSwitches)` and
`CONVEX A(routeros:getInterfaces)` / `getIpAddresses`.

### Root causes
1. Credential encryption requires `ROUTER_CREDENTIALS_ENCRYPTION_KEY` (base64
   of 32 bytes, AES-256-GCM) on the deployment the app runs against. When it
   is missing, `convex/lib/routerCredentials.ts` throws "Router credential
   protection is not configured.", the `routers:updateRouterCredentials`
   mutation aborts, and the edit appears to "not save". It also breaks the
   `routeros:getInterfaces` / `getIpAddresses` actions, which decrypt stored
   credentials before connecting.
2. Deployment targeting gotcha: `npx convex run` / inline queries default to
   the deployment selected by `convex.json` + `.env.local`
   (`CONVEX_DEPLOYMENT`), NOT to `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_URL`.
   Probing "prod" without `--prod` silently hit the local deployment whose
   schema/code/env are stale (old functions, no users, plaintext credentials),
   which produced the bogus "function not found" and "empty users"
   conclusions. Always pass `--prod` for production reads.
3. Live network reads vs private routers: `routeros:*` actions run on the
   Convex backend, so a router URL like `https://192.168.1.1:8443` (RFC1918)
   is unreachable from Convex cloud. Those reads fail from prod by design; the
   collector (`collector/forwarder.mjs`, runs on-prem) is the supported path
   for private-LAN routers. PortSelect/NetworkAddressField dropdowns fall back
   to cached telemetry + "Custom value".
   - Confirmed 2026-09-05 via `npx convex logs --prod --history 400 --jsonl`:
     the action executes, auth passes, credentials decrypt, and the thrown
     error is exactly
     `Uncaught ConvexError: The router could not be reached over the network.
     Verify the router URL, credentials, and network path.` at
     `readRouterResource (../convex/routeros.ts:67:6)` from the routerRead
     handler (`routeros.ts:169:13`). Meanwhile the collector path is healthy:
     `POST /collector/ingest` 200, `collector:ingestSnapshot`,
     `routerCredentialActions:getDecryptedCollectorConnection` completing with
     no errors. The browser console shows this as a generic "Server Error"
     because Convex masks raw action errors; the deployments log carries the
     real message.

### Fix applied
- Generated a new 32-byte key, set it on prod (`npx convex env set
  ROUTER_CREDENTIALS_ENCRYPTION_KEY <key> --prod`), on the local deployment
  (without `--prod`), and added it to `.env.local`.
- Re-saved the router credentials via `routers:updateRouterCredentials` on
  prod (router id `js75rvvax05pj9wz6hta2tasr98dtdbs`, user `MylesNet`) with
  the owner identity; verified the stored `mnrc.v1.` ciphertext decrypts back
  to the intended value with the new key.
- Verified prod queries now work:
  `npx convex run networkSwitches:listSwitches '{}' --prod --identity ...`
  returns `[]`.
- `routeros:*` live reads still can't reach a private-LAN router from prod
  (expected). To fully exercise those from the browser, the router's REST API
  must be reachable at a public URL the Convex backend can hit.

### Self-service next time (if "credentials won't save" recurs)
1. Set the key on the right deployment:
   - prod:  `npx convex env set ROUTER_CREDENTIALS_ENCRYPTION_KEY <key> --prod`
   - local: `npx convex env set ROUTER_CREDENTIALS_ENCRYPTION_KEY <key>` (no --prod)
   - also add to `.env.local` for `convex dev`.
2. Re-save the router username/password in the app. The mutation now encrypts.
3. To check encryption works from the backend, run:
   `npx convex run routers:updateRouterCredentials '{"routerId":"<id>","username":"<u>","password":"<p>"}' --prod --identity '{ ... }'`
   A clean exit means the write succeeded.
4. Remember which deployment `convex run` / queries target: add `--prod` for
   production, omit it for the local dev deployment.

## Access point user / traffic attribution fix (2026-09-06)

Reported: AP cards on the dashboard show the "Users" section empty and no per-AP
data/Speed/GB. Diagnosis found the hotspot server is bridged
(`centipid-hotspot` on `centipid-bridge`), so RouterOS `/ip/hotspot/active`
entries carry NO `interface` field, while the collector's
`normalizeHotspotSessions` read only that missing field and set
`interfaceName` to `""`. Every session then failed `accessPointByPort` lookup →
`activeHotspotSessions.accessPointId` and `usageSamples.accessPointId` were
always `undefined` → 0 users, 0 daily bytes per AP (router-level totals were
fine). Interface counter samples were unaffected, so speed rendered while user
counts/data did not.

### Fix applied
- `collector/forwarder.mjs`:
  - `normalizeHotspotSessions` now also captures the client MAC
    (`mac-address`, uppercased).
  - New `normalizeBridgeHosts` reads `/interface/bridge/host`
    (`readExtendedGroup`) and emits `{ macAddress, interfaceName }`; the
    bridge-host table is the authoritative MAC → physical port map for bridged
    clients (AP device MACs sit on their own ether ports there, clients on the
    ether/wlan port they associate with).
  - Snapshot payload now includes `bridgeHosts`.
- `convex/collector.ts` (`collector:ingestSnapshot`):
  - `hotspotSessionValidator` accepts optional `macAddress`; new
    `bridgeHostValidator`; ingest args accept optional `bridgeHosts`.
  - Builds `portByMac` and `resolveAccessPointForSession`: uses
    `session.interfaceName` when present (non-bridged setups keep working),
    otherwise resolves the client MAC → bridge port → access point.
  - `accessPointSamples.connectedUserCount` and the session loop now use the
    resolver, so sessions behind bridged APs (e.g. YRBWAD on ether2 → AP1,
    MamaSaloon on ether4 → AP3) get a real `accessPointId`. Clients on the
    router's own wlan1 (Rinnah/Remi) correctly stay unattributed.
- Expected result: AP cards show active users, per-AP usage bytes, and
  per-AP user lists once the backend is deployed (`npx convex deploy`) and the
  collector restarted.

# Build decisions — 2026-09-10 snapshot: captive portal (T-HOT)

> **2026-09-10 snapshot:** canonical scope for the captive portal /
> hotspot module is `docs/captive-portal/captive-portal-specification.md`
> (byte-identical mirror of the vault `products/mylesnet/captive-portal-specification.md`).
> Companion flows: `docs/captive-portal/captive-portal-flows.md`. Decision-log
> authority: vault `products/mylesnet/decisions.md` (2026-09-10) plus
> `captive-portal/ADR.md`.

## Build-facing rulings (mirrored from the vault decision log)

- **Single system, no separate portal app.** The portal is a route surface in
  this repo's unified Next.js app. Screens and logic live in the `captive-portal/`
  folder; thin stubs `app/(portal)/hotspot/**`, thin adapters `convex/portal/`;
  `@portal/*` alias; tenant resolved by hostname. Supersedes any `apps/portal`
  "approval-gated do-not-create" item.
- **Tier order for auth domains**: voucher, phone + SMS OTP,
  MAC/HTTP-cookie, IP binding in MVP; username/password, scratch cards, guest,
  email magic link in v1.1; WhatsApp/social gated on a pre-auth provider
  allowlist.
- **Multi-path reconnection is mandatory** (detection ladder → manual
  fallbacks: voucher re-entry, phone+OTP, voucher QR, credentials) with a
  welcome-back dashboard. Never a single locked path for an active subscriber.
- **Free trial** is one-time per device/phone with a tenant-configurable reset
  window — `freeTrialClaims.claimedAt/reclaimableAt`.
- **Payments are in-portal** (M-Pesa STK Push first; Airtel/cards behind the
  adapter wall). Strict state model plus application-vs-network state
  (`payment_confirmed / provisioning / connected / reconnection_failed`) —
  never claim connectivity without router-verified state.
- **Branding**: template system + color/logo/background/font/language overrides,
  token-bound. **Splash**: terms/privacy acceptance + optional operator splash;
  no third-party ad platform in MVP.
- **Devices**: self-service (list/rename/remove) with per-plan limits,
  operator-configurable.
- **RADIUS order**: Phase 6 uses Convex-direct RouterOS API (approval-gated);
  FreeRADIUS (N-AAA/N-ACC) is the Phase 7 upgrade path — no Phase 6↔7 wait.
- **Schema**: additions centralized in `convex/schema.ts` under Phase 1 schema
  governance (`captivePortalSettings`, `captivePortalSessions`,
  `captivePortalTemplates`, `freeTrialClaims`, `portalContent`, `termsAcceptances`;
  plus `advertisements.placement`, feedback categories, and a **planned** `sites`
  inventory entity §18.8 — optional pointers only, formal definition with N-RT/N-IP
  at Phase 8).

## Build decisions — 2026-09-10 snapshot: public pricing contract

> **2026-09-10 snapshot:** [[Jonathan Myles]] approved the MylesNet public
> pricing contract on 2026-09-10: monthly plans **Starter KES 500 · Growth
> KES 1,400 · Pro KES 3,500** (KES is the base/authoritative currency),
> **14-day free trial**, and a **20% referral commission for 12 months**.
> Decision-log authority: vault `products/mylesnet/decisions.md` (2026-09-10) +
> Master Part C §C3 ledger row.

- **Implementation (`apps/web/app/(landing)/`).** `content/rates.ts` — cached FX
  snapshot (`asOf: 2026-09-10`, base KES, parity 28 UGX/KES + USD 130/KES) and
  `formatPrice()` (KSh/USh integers, USD 2-dp), no runtime FX call, no new
  dependency. `components/PricingPlans.tsx` — client component, currency state
  seeded from the server geo default, KES/UGX/USD switcher (`aria-pressed`), 3
  tier cards with Growth = "Most popular", shared CTA to `/get-started`.
  `pricing/page.tsx` — server component that reads `headers()`
  (`x-vercel-ip-country`: KE→KES, UG→UGX, else USD fallback) and renders the
  banner, plans, shared-features checklist, trial + referral cards, cached-rate
  note, and CTA band. Route is dynamic (ƒ) by design (uses `headers()`); the
  currency switcher holds local `useState` so there is no hydration mismatch.
- **Gates.** `pnpm lint` 0, `pnpm typecheck` (tsc) 0, `pnpm tokens:check` green,
  `pnpm build` green (75 routes, `/pricing` ƒ), `pnpm test:ui` 5/5,
  `pnpm test` 44/44. Runtime smoke (fresh dev server, port 3001): `/pricing`
  200 with geo-fallback USD rendering $3.85 / $10.77 / $26.92 (approved
  conversions) and the KES/UGX/USD switcher on the page with correct
  `aria-pressed` initial state.
- **Public copy constraints held:** no competitor names (the Centipid benchmark
  was used only as an internal pricing signal — flat monthly vs revenue-share),
  no invented metrics, no internal stack/provider names. Manual checks still
  pending: 390px mobile pass + a11y keyboard pass (existing standing item).

# Phase 1 tenancy (X-TEN) — build log 2026-09-11

> **2026-09-11:** Phase 1 (Tenant Schema and Data Isolation) is the active
> first-order gate. Phase 2 (Identity/RBAC) is stop-gated until Phase 1
> acceptance evidence exists. Decision-log authority: vault
> `products/mylesnet/decisions.md` (2026-09-11) + `convex/schema.ts` Phase 1
> section.

## Schema

- `const tenantScope = { tenantId: v.optional(v.id("tenants")) } as const;`
  added after imports in `convex/schema.ts`; `...tenantScope,` spread applied
  to all **60 tenant-owned tables**. New tables: `tenants`
  (indexes `by_slug`/`by_status`/`by_workosOrganizationId`),
  `tenantMemberships` (`by_user`/`by_tenant`/`by_user_tenant`, unique
  user+tenant), `entitlements` (`by_tenant`). 11 platform/global tables are
  deliberately exempt (users, roles, invitations, centipidCredentials,
  exchangeRates, marketProspects, investors, investorReports, standardSiteKit,
  system_settings, migrationRuns).
- Inventory + staged plan live in `convex/lib/tenantMigration.ts`
  (`TENANT_OWNED_TABLES`, `PLATFORM_OWNED_TABLES`, `tenantMigrationPlan`,
  feature flags `tenant.backfill|readPath|writePath|enforceRequired`,
  `runId = tenantid-backfill-001`).
- Review-queue resolutions (transition-inventory §9) are recorded in the vault
  decision log; 6 signed in this push (systemEvents, auditLog,
  notificationPreferences, organizationMemberships, marketOperatingCosts,
  investors/investorReports), **2 pending owner confirmation** (centipidCredentials
  = global provider credential, agents/teams = single-tenant ownership). Neither
  pending item blocked this schema push; both are reversible.
- by_tenant indexes on existing tenant-owned tables are **deferred** to the
  read-path step (kept this push low-risk; recorded, not omitted).

## Isolation library (pure, node:test-covered)

- `convex/lib/tenantCore.ts` — TenantStatus guards, `assertNoClientOverride`,
  `assertTenantMatch`, `decideTenantAccess`.
- `convex/lib/tenant.ts` — Convex wrapper: `resolveTenantFromAuth` (WorkOS org
  claim → `by_workosOrganizationId`, then `mylesnet` bootstrap slug fallback,
  then null), `requireTenantMember` (identity + `tenantMemberships` by_user_tenant),
  `withTenantScope`, re-exported pure guards.
- `convex/lib/tenantContracts.ts` — `tenantAuditKey` (`ten.<tenantId>:…`),
  `tenantStorageKey` (`ten/<tenantId>/…`), `tenantJobEnvelope`,
  `webhookTenantId` (unknown → null = quarantine), `tenantTransferRunId`,
  `isValidTenantIdFormat`.
- `convex/lib/tenantIsolationCore.ts` — denial catalogue
  (`DENIAL_CATALOGUE`, `denialReasonForTenantPair`, `expectationForScenario`).
- `convex/tenantMigrations.ts` — `runTenantIdBackfill` **gated no-op stub**
  (reports plan surface; NOT wired into crons; real backfill needs the review
  queue signed off + `tenant.backfill` flag + confirmed prod deploy).

## Tests + gates

- New: `convex/lib/{tenantCore,tenantContracts,tenantMigration,tenantIsolationCore}.test.ts`
  (node:test). `pnpm test` now **70/70**.
- Gates this push: lint 0, tsc 0 (app + new convex files), `tokens:check` green,
  `test:ui` 5/5, `test:collector` 10/10. `pnpm build` deferred —
  an existing `next build`/dev process already held the build lock and this
  change is convex-only.
- Nothing pushed (standing rule); the 5 relocation commits for the Vercel
  `main` promotion and the approved landing redesign remain uncommitted/excluded.

# Auth/RBAC verification decisions — 2026-09-13

- **MFA guard policy:** `platform_owner`, `platform_admin`, `ops_manager`, and
  `finance_manager` fail closed when the WorkOS-synced MFA marker is absent.
  Shadow mode or `off`/`partial` enforcement are explicit operational overrides
  only; the default remains full enforcement.
- **CSRF exchange:** `__mylesnet_csrf` stays HttpOnly. An authenticated route
  issues the corresponding request-header token, validates it before its POST
  mutation, rotates it after success, and clears it on a failed exchange. Do
  not make the cookie JavaScript-readable.
- **Tenant hostname signal:** `__mylesnet_tenant` is a hostname-derived UX hint
  only. Convex scope stays derived from the authenticated WorkOS organization
  and membership; a browser cookie never authorizes a tenant query.

## Platform control-plane panel ? 2026-09-14

- **Scope confirmed:** /platform is the full MylesCorp control plane, not a
  thin tenant switcher. Panels spec 'docs/design/panels.md' plus Master
  Technical Spec v3 (APP C1/APP21) are the contract.
- **Surface shape:** second-level left rail (PlatformNav) under the shared
  product shell, gated by requirePanelAccess('platform'); pages: Overview,
  Tenants list, Tenant detail, Subscriptions, Access & roles, Audit log,
  Security. Pre-existing /platform/tenant-control page moved to
  /platform/tenants.
- **Backend additions (Convex):**
  - tenantControl.getTenantDetail (query) ? tenant + WorkOS org id +
    entitlements + member roster; guard requirePlatformUser.
  - tenantControl.setEntitlement (mutation) ? upsert entitlements table row;
    guard requirePlatformAdmin; audit tenant.entitlementSet/Changed.
  - tenantControl.entitlementStatus union = trial | active | expired |
    suspended (distinct from tenant lifecycle status).
  - platform.listAuditLogPage (query) ? real Convex cursor pagination via
    lib/auditLog.listAuditLog .paginate(); kept the legacy listAuditLog for
    the existing /audit-log page.
  - platform.getPlatformSecurityOverview (query) ? tenant estate incl.
    WorkOS identity coverage, staff MFA posture (MANDATORY_MFA_ROLES),
    workosWebhookEvents by status, 24h webhookDeliveryLog stats, feature
    flags.
- **Explicit client bindings:** apps/web/lib/convex/platformPanel.ts via
  makeFunctionReference. Generated api remains pinned (no regeneration).
- **Explicitly deferred / not built:** tenant cancellation/offboarding data
  retention; real SaaS invoices/billing (entitlements only - schema gap);
  tenantId backfill execution (gated stub only); deep CRUD on Access (links
  to full /access); retirement of legacy network-ops console surfaces.
- **Runtime note:** the new Convex functions require a deployment boundary
  sync before live use. Code, typecheck, lint, tests and build gates pass
  without a live deployment.

## Platform-panel reconciliation build — 2026-09-14

Per the build/reconciliation directive (one Linear issue per module; result of
skipped Linear: manual backlog). Verification was file-based re-read of every
spec module A1–O2; **the prior audit's module-level claims were not trusted**.
Outcome table: 0 Confirmed, 21 Partial, 14 Not present, 1 Excluded (C2 tenant
SaaS invoices — confirmed not started, left unstarted per directive).

- **RBAC foundation (built + tested, 4/4 new tests):**
  - `platform_readonly` system role added (`convex/lib/permissions.ts`, rank
    150, 33 read-only permissions, `syncToWorkos: true`). Rationale: no
    existing role covered "view everything platform-wide, write nothing";
    `investor_viewer` is financials-only. Roles seed idempotently via
    `rolesAdmin.seedLocalSystemRoles` — no seeding-code change needed.
  - `PLATFORM_SUB_ROLE_MAP` (spec sub-role → concrete slug list):
    `platform_super_admin` → `platform_owner` + `platform_admin`;
    `platform_ops` → `ops_manager`; `platform_finance` → `finance_manager`;
    `platform_support` → `platform_support`; `platform_readonly` →
    `platform_readonly`. `requirePlatformSubRole(ctx, allowedSubRoles)` added
    to `convex/lib/auth.ts`, flatten+dedupe then delegates to `requireAnyRole`;
    unknown sub-roles pass through so literal slugs also work.
  - Mapping is the contract: `convex/lib/subRoleMapping.test.ts` asserts every
    spec sub-role resolves to an existing system role and that
    `platform_readonly` grants zero write permissions.
- **A1 Tenants RBAC tiers:** `setStatus`, `setEntitlement`, and the
  `assertProvisioner` internal bridge now require platform_super_admin +
  platform_ops (owner, admin, ops_manager) via `requirePlatformSubRole`, not
  flat `requirePlatformAdmin`. Reads stay `requirePlatformUser` (all platform
  roles). Matches spec CRUD super_admin+ops(CRUD)/finance+support+readonly(R).
- **A3 suspension cascade wired (behavior change, no schema migration):**
  `canTenantOperate(status)` added to `tenantCore` (blocks only explicit
  `suspended`/`cancelled`; unset status stays allowed so pre-backfill rows keep
  working). Enforced in `requireTenantMember` and `withTenantScope` — a
  suspended tenant now denies its members' tenant-scoped reads/writes at the
  gate instead of only being flagged in the tenants panel. Test added.
- **B2 Provisioning queue (built end-to-end):**
  - New tenant-scoped table `provisioningRequests` (`convex/schema.ts`) — new
    table, so no existing-table migration gate; fields per spec: tenantId,
    marketId, deviceId?, requestedFirmware?, requesterId, requestedAt, status
    (pending/approved/rejected/deployed), decidedBy/At, decisionNote;
    indexes `by_tenant`, `by_tenant_status`, `by_market`.
  - New permissions `provisioning:read`/`provisioning:manage`: CRUD granted to
    owner/admin/ops_manager; read granted to support, market_manager,
    network_operator, platform_readonly (matches spec super_admin+ops CRUD,
    others R).
  - `convex/provisioning.ts`: list (enriched with requester/decision names),
    get, requestDeviceProvisioning (validates market + that a pending request
    for the same device does not already exist), decideProvisioningRequest
    (lane-checked via `convex/lib/provisioningCore.ts` state machine),
    markProvisioningDeployed. Every write audit-logged; reads via
    `provisioning:read`, writes via `provisioning:manage`.
  - `convex/lib/provisioningCore.ts` pure state/guard logic +
    `provisioningCore.test.ts` (5/5). Bugs fixed during tests: empty-string
    firmware was tolerated (falsy check) — now explicitly label must trim to
    3–80 chars.
  - UI: `PlatformProvisioning.tsx` + route `app/(app)/platform/provisioning/`
    + nav entry in `UnifiedShell` (ServerCog), bridged via
    `apps/web/lib/convex/provisioning.ts` with `makeFunctionReference`
    (generated `api` stays pinned — no regeneration).
- **E1 Commissions RBAC fix:** `accrueCommission`,
  `approveCommissionPayout`, `markCommissionProcessing`, `markCommissionPaid`
  moved from `requirePlatformAdmin` to `requirePermission(ctx,
  "commissions:manage")` (finance_manager + admin). `approveCommissionPayout`
  keeps `assertNotSelfApproval`. E2 payouts verified already permission-based
  (`payouts:manage`, owner for tier_3) — no change needed.
- **Deferred with schema-gate flag (stop+report before migrating):** B1 device
  fleet fields (firmware/uptime%/provisioning status on existing `devices`
  table — `lastSeenAt`, `deviceType`, `routerId`, `accessPointId` already
  exist); F1 voucher fraud monitor device/IP/velocity tracking (would extend
  existing tenant-scoped `vouchers`); K feature flags (generic flag store);
  L2 tamper-evident audit hash chain (would extend `auditLog`; append-only +
  `by_entity` existing, no `prevHash` anywhere).
- **Deferred by dependency:** B3 RADIUS fleet registry (FreeRADIUS is the
  Phase 7 path); N impersonation + G2/G4 API keys + L3 data requests +
  M1/M2/O2 (recorded as not present — not speculative-scaffolded).
- **Gates:** `pnpm typecheck` 0, `pnpm test` 117/117, `pnpm lint` 0,
  `pnpm tokens:check` green, `pnpm build` green. Nothing committed (standing
  rule; tree stays dirty on `myles/vercel-production-redeploy`).
- **New Convex functions require a deployment boundary sync before live use**:
  `provisioning:listProvisioningRequests`, `getProvisioningRequest`,
  `requestDeviceProvisioning`, `decideProvisioningRequest`,
  `markProvisioningDeployed`. Schema adds `provisioningRequests` table + two
  permissions.

### Batch 1 (K, B1, F1) — approved & built 2026-09-14

Schema additions (additive, no backfill):

- **K — `featureFlags` table** (global, deliberately not tenant-scoped): `key`,
  `valueJson`, `enabled`, `description?`, `tenantIds?`, `createdBy?`,
  `createdAt?`, `updatedAt`, `updatedBy?`, `.index("by_key")`. Percentage
  rollout is encoded in `valueJson` as an integer `rolloutPercent` (0-100);
  evaluation order = `enabled` off → global off; `tenantIds` list → only those
  tenants; `rolloutPercent` → deterministic per-(key, tenant) hash sampling;
  otherwise global-on. `requirePlatformSubRole`: reads any platform user,
  create/delete `platform_super_admin`, update `platform_super_admin` +
  `platform_ops`.
- **B1 — `devices`**: + `firmwareVersion?`, `uptimePercent?`,
  `provisioningStatus?` (`unprovisioned|pending|provisioned|failed`),
  `.index("by_provisioningStatus")`. Fleet registry queries join device →
  market → tenant name with no mutation of tenant resolution rules.
- **F1 — `vouchers`**: + `redeemedDeviceId?`, `redeemedIpAddress?`,
  `fraudFlagStatus?` (`clean|flagged|blocked`), `fraudFlagReason?`.
  `voucherEvents`: + `redeemedDeviceId?`, `redeemedIpAddress?`. `redeemVoucher`
  and `centipid.handleVoucherEvent` now persist the forensic fields. Velocity
  stays query-time derived — no counter column.

New Convex functions (all added to the deployment-boundary-sync list below):

- `featureFlags:listFeatureFlags`, `getFeatureFlag`, `setFeatureFlag`,
  `removeFeatureFlag`, `evaluateFeatureFlag`
- `fleet:listDeviceFleet`, `getDeviceFleetRow`, `updateDeviceFleetRow`
- `voucherFraud:listRedemptionMonitor`, `flagVoucher`

Routes: `/platform/feature-flags` (list + create/edit/delete),
`/platform/feature-flags/[flag]` (detail + evaluate), `/platform/infrastructure/devices`
(list + edit posture), `/platform/infrastructure/devices/[deviceId]` (detail),
`/platform/vouchers/monitor`. Nav + overview cards updated.

- **Tests:** new cores `featureFlagCore`, `fleetCore`, `voucherFraudCore` (pure
  logic, node:test). Happy + rejection per function covered through the pure
  cores; multi-tenant isolation asserted in `fleetCore` (a device never labels
  another tenant's name) and `voucherFraudCore` (same market across distinct
  customers is not cross-flagged). Full run 142/142.
- **Gates (this batch):** `pnpm typecheck` 0, `pnpm lint` 0, `pnpm tokens:check`
  green, `pnpm test` 142/142, `pnpm build` green (all five new routes emitted).
  Nothing committed (standing rule; tree stays dirty on
  `myles/vercel-production-redeploy`).
- **L2 audit hash chain deferred** by authorization: starts as its own deploy
  only after Batch 1 lands green. Option A only.
