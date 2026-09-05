# Build decisions

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
