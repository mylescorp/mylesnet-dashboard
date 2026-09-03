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
