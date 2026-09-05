# Build decisions

## Master Admin (`/platform`) — build log

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
  `CENTIPID_MCP_TOKEN` from the operator's git-ignored `.env.local`.
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
