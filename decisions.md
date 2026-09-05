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
