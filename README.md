# MylesNet Network Operations Dashboard

A network operations and ISP business dashboard. It monitors multiple MikroTik routers (hotspot sessions, router health, access points, switches, DHCP, queues, usage) through a local collector, and layers the business on top — Centipid events, markets, agents, vouchers, commissions, payouts and role-based access for every part of the operation.

## Security Architecture

**CRITICAL SECURITY DESIGN**: RouterOS credentials are never exposed to the browser. A local collector running within the router network makes the RouterOS REST reads and sends normalised telemetry to the backend over HTTPS.

- Router credentials remain server-side and are released only to a verified collector over HTTPS
- The browser never receives router credentials in any query result
- The hosted backend never directly reaches a private router address
- The Next.js frontend talks ONLY to Convex (queries/mutations/subscriptions)

## Local Router Collector

Run the collector on a device in the same private network as the router.

1. Copy `collector/.env.example` to `collector/.env.local` on the collector device. The start command loads this uncommitted file automatically.
2. Set `MYLESNET_COLLECTOR_INGEST_URL` to the deployed Convex Site endpoint ending in `/collector/ingest`.
3. Set the same strong `MYLESNET_COLLECTOR_SHARED_SECRET` in the collector environment and the Convex deployment environment.
4. Set `MYLESNET_COLLECTOR_ROUTER_ID` to the router identifier shown in the dashboard. The collector securely obtains that router's saved connection on each collection cycle.
5. Run `npm run collector:check` once. It exits successfully only after the router read and dashboard delivery both succeed.
6. Start continuous collection with `npm run collector:start`.

For this local operations workstation, use `npm run collector:local:check` and then `npm run collector:local`. These commands obtain the signing secret from the protected production configuration at runtime rather than storing it in `collector/.env.local`.

The collector reads the RouterOS REST endpoints listed under "RouterOS REST API Paths Used" below. It issues no external traffic tests, and its only write operation is a single scoped self-heal correction: re-enabling the `www-ssl` service when a router's REST API has stopped (see HealthGuard below).

## Features

- **Multi-Router Support**: Monitor multiple routers/markets from a single dashboard
- **Live Dashboard**: Real-time view of connected users, router health, and access point status
- **Service Assurance**: Continuous health sampling via the local collector (CPU, memory, link state, traffic, errors)
- **Switch Monitoring**: Registry and live health of managed/unmanaged access switches behind each router
- **HealthGuard Self-Healing**: The collector watches the RouterOS `www-ssl` REST service and re-enables it if it stops — the only RouterOS write in the system (opt-out via `MYLESNET_HEALTHGUARD_ENABLED=0`)
- **Router Console**: Per-router tabs for Overview, Setup, Access points, Switches, DHCP & queues, Live inspection, Configuration watch and Thresholds
- **Incident Tracking**: Automatic incident creation for link failures, high CPU, and router unreachability
- **Shift Notes**: Operator notes for handover and operational context
- **Usage Reporting**: Per-user and per-access-point usage statistics with CSV export
- **Configuration Watch**: Baseline configuration tracking to detect unexpected changes
- **Centipid Integration**: Real-time business event tracking (subscribers, payments, vouchers, tickets) via webhooks
- **Business Activity Feed**: Live feed of billing events from Centipid with filtering capabilities
- **Connected User Count**: Real-time hotspot session tracking from RouterOS
- **Business Operations**: Markets, agents and vouchers, commissions and payouts, expenses and operating costs, investor reports
- **Role-Based Access**: Data-driven permission catalog (10 system roles) enforced server-side on every query, mutation and action

## Access Roles

One unified dashboard serves every role; the sidebar shows only what the signed-in
role can reach. Access is a permission catalog (`convex/lib/permissions.ts`) applied
in the Convex backend as the security authority on every query, mutation and action.
System roles live in a data-driven `roles` table and are mirrored to the WorkOS
environment (with baseline access permission `dashboard:access`); `network_operator`
is a local-only role and is not mirrored to WorkOS.

- **platform_owner** – full control, including role management and irreversible actions
- **platform_admin** – day-to-day operations: invite users, manage access, run the business (cannot manage roles)
- **member** – default organization member with basic dashboard access
- **ops_manager** – network operations lead: estate, alerts, maintenance, teams and site kit
- **finance_manager** – owns money: expenses, payouts, financials, plans, reports and investor ops
- **market_manager** – runs one to several markets end-to-end, scoped by market membership
- **platform_support** – read-only operational visibility plus ticket handling
- **agent** – client-facing field role; dashboard entry only (revenue hidden)
- **investor_viewer** – read-only financial reporting for investors
- **network_operator** – internal network operations role; not mirrored to WorkOS

Legacy `/platform/*` URLs permanently redirect to their flattened equivalents
(see `next.config.ts`).

## Tech Stack

- **Frontend**: Next.js 16.3 with TypeScript, React 19 and Tailwind CSS v4
- **Backend**: Convex (database, scheduled functions, server-side actions)
- **Authentication**: WorkOS AuthKit SSO (redirect-based sign-in with custom JWT verified by Convex) - no username/password provider
- **Hosting**: Vercel (frontend) + Convex (backend)

## Router Onboarding Guide

### Step 1: Enable RouterOS REST API

On your MikroTik router, enable the REST API service:

1. Access your router via Winbox, SSH, or the web interface
2. Navigate to `IP` → `Services`
3. Find `www-ssl` and enable it
4. Set the port to `8443` (or your preferred HTTPS port)
5. Ensure the service is accessible from the local collector device. Do not expose the router REST service to the public internet.

### Step 2: Create Dedicated RouterOS Account

**RECOMMENDED**: Create a dedicated RouterOS account for the collector:

```routeros
# Create a dedicated monitoring user
/user add name=mylesnet_monitor group=read password=YOUR_SECURE_PASSWORD

# Alternatively, create a custom group with specific permissions
/user group add name=mylesnet_monitoring policy=ftp,reboot,read,test,winbox,api,local,telnet,ssh,webfig,sensitive
```

**IMPORTANT**: This account should have:
- `read` permission for all monitored endpoints
- `rest-api` access enabled
- A strong, unique password
- No access to sensitive configuration changes

> **HealthGuard write permission.** If you want the collector's HealthGuard self-heal
> to re-enable the `www-ssl` service when it stops, the account also needs write access
> to RouterOS services (e.g. the `write` policy or a group that can modify `/ip/service`).
> If you prefer a strictly read-only account, set `MYLESNET_HEALTHGUARD_ENABLED=0` on
> the collector to disable the self-heal write; the rest of monitoring stays read-only.

### Step 3: Configure TLS Certificate

Use a certificate trusted by the collector device for the RouterOS `www-ssl` service. The collector intentionally rejects untrusted certificates rather than weakening TLS validation. Import the issuing CA into the collector device trust store, or use a certificate issued by a trusted authority.

### Step 4: Add Router to Dashboard

1. Sign in to the MylesNet Dashboard
2. Navigate to "Routers"
3. Click "Add Router"
4. Fill in the required information:
   - **Router Name**: e.g., "Tayari Router"
   - **Location**: e.g., "Tayari Market"
   - **REST Base URL**: e.g., `https://192.168.1.1:8443` (include port)
   - **RouterOS Username**: The dedicated monitoring account username
   - **RouterOS Password**: The dedicated monitoring account password
   - **CPU Warning Threshold**: CPU % for warning alerts (default: 75%)
   - **CPU Critical Threshold**: CPU % for critical alerts (default: 90%)

5. Click "Add Router"

### Step 5: Register Access Points

After adding a router, register your physical access points:

1. Navigate to the router details page
2. Click "Add Access Point"
3. Fill in the required information:
   - **Name**: e.g., "AP1 - Main Hall"
   - **Port**: e.g., "ether2", "ether3", "ether4", "wlan1"
   - **Device Type**: e.g., "cpe220", "indoor_ap", "builtin_radio", "other"
   - **Shares Port With**: (Optional) For daisy-chained devices

4. Click "Add Access Point"

### Step 6: Verify Monitoring

After setup:
1. Navigate to the main dashboard
2. Select your router from the dropdown
3. Verify that:
   - Router health data is being collected (CPU, memory, connected users)
   - Access points show correct link status
   - Health samples are being written on each collector cycle (collector interval defaults to 15 seconds)
   - Connected user count is being tracked from hotspot sessions

## Centipid Integration Guide

### Step 1: Generate Centipid MCP API Token

1. Log in to your Centipid Billing account at [docs.centipidbilling.com](https://docs.centipidbilling.com)
2. Navigate to Developer Settings → API Tokens (MCP)
3. Create a token named "MylesNet Dashboard" and copy it — format `12|…`
4. The token is used (a) on the operator's machine by the opencode MCP client and (b) by the
   dashboard's "Fetch historical snapshot" and "Verify token" actions via read-only MCP tools.

### Step 2: Configure Webhook in Centipid

1. In Centipid, navigate to Developer Settings → Webhooks
2. Add a new webhook with URL: `[YOUR_CONVEX_HTTP_ACTION_URL]`
   - The webhook URL will be displayed in the dashboard's Centipid Settings page
   - It will look like: `https://<deployment>.convex.site/receiveCentipidWebhook`
3. Generate a signing secret and copy it
4. Enable these events:
   - `subscriber.created` - When a new subscriber is created
   - `subscriber.paused` - When a subscriber is paused
   - `subscriber.resumed` - When a subscriber is resumed
   - `payment.received` - When a payment is received
   - `payment.refunded` - When a payment is refunded
   - `voucher.generated` - When a voucher is generated
   - `voucher.redeemed` - When a voucher is redeemed
   - `ticket.opened` - When a support ticket is opened
   - `ticket.resolved` - When a support ticket is resolved

### Step 3: Connect Dashboard to Centipid

1. Sign in to MylesNet Dashboard
2. Navigate to "Centipid Settings" (in the sidebar)
3. Paste your API token from Step 1
4. Paste your webhook signing secret from Step 2
5. Click "Save Credentials"
6. The webhook URL will be displayed - verify it matches what you configured in Centipid

### Step 4: Configure Environment Variables

The MCP token and webhook signing secret are **entered in the Centipid Settings page**, where they
are encrypted with AES-256-GCM before being stored in the database. They are never committed and
are not passed as app env vars. The only Centipid-related env vars are the server-side encryption
key and the operator-local MCP token used by the opencode MCP client:

**For local development (`.env.local`):**
```env
CENTIPID_CREDENTIALS_ENCRYPTION_KEY=your_base64_32_byte_key
CENTIPID_MCP_TOKEN=12|your_mcp_token   # opencode MCP client only, never read by the app
```

> **MCP token gotcha:** opencode does **not** read `.env.local`. This repo's
> `opencode.json` loads the token from `{file:~/.config/opencode/centipid.token}`
> (a git-safe, machine-local file containing exactly `12|...`, no trailing
> newline). Paste the token into that file (create it if missing), or set the
> token in your shell via `setx CENTIPID_MCP_TOKEN "12|...` — then start
> opencode from a new terminal so the change is loaded.

**For Vercel / Convex production:**
1. Generate a base64 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Go to your hosting dashboard → project → Settings → Environment Variables
3. Add only `CENTIPID_CREDENTIALS_ENCRYPTION_KEY` with the generated value
4. Save and redeploy

### Step 5: Perform Historical Backfill (Optional)

When first connecting a router or after webhook delivery issues:

1. Navigate to "Centipid Settings" (admin role required)
2. Click "Verify token", then "Fetch historical snapshot"
3. This best-effort reads a batch from the read-only MCP tools (`list_subscribers`,
   `payments_report`, `voucher_stock`, `open_tickets`)
4. The data populates the business activity feed; webhooks remain the source of truth

### Step 6: Verify Integration

1. Check the connection status on the Centipid Settings page
2. Verify "Connection" shows "Configured"
3. Trigger a test event in Centipid (e.g., create a test subscriber or generate a test voucher)
4. Navigate to "Business events" in the sidebar
5. Verify the event appears in the feed within a few seconds
6. Check the "Webhook deliveries" section on the Centipid Settings page for any errors

### Security Notes for Centipid Integration

- The Centipid MCP token and webhook signing secret are encrypted at rest in the Convex database
  (AES-256-GCM); plaintext only ever exists on the server during use
- The webhook signing secret is never exposed to the client
- All webhook payloads are HMAC-verified against the raw body before processing
- Duplicate webhook deliveries are rejected (idempotent on the webhook event id)
- The dashboard is read-only - it never writes back to Centipid (the 3 approval-gated MCP tools
  are intentionally never called)
- No customer PII or payment details are stored in shift notes
- Webhook delivery logs are pruned after 30 days and their raw payload previews wiped;
  event rows and projection state are pruned after 24 months
- The receiver starts in capture mode (acknowledges and logs deliveries, writes no events) until
  credentials are configured and a real signed delivery pins the provider contract

## RouterOS REST API Paths Used

The dashboard backend only issues read-only RouterOS REST calls. The collector reads
the following endpoints on each cycle:

- `/system/resource` - System resources (CPU, memory)
- `/system/health` - Temperatures, voltages, fan state (where supported)
- `/system/identity` - Router identity/name
- `/interface` - Interface list
- `/interface/bridge/host` - Bridge host information (MAC-to-port mapping)
- `/interface/ethernet` - Ethernet link state and counters
- `/interface/wifi` - WiFi registration (falls back to `/interface/wireless`)
- `/ip/hotspot/active` - Active hotspot sessions
- `/ip/pool` - IP pool configuration
- `/ip/dhcp-server/lease` - DHCP leases
- `/ip/address` - Configured addresses
- `/ip/route` - Routing table
- `/ip/dns` - DNS resolver configuration
- `/queue/simple` - Simple queues
- `/ip/firewall/filter` - Firewall filter rules

**HealthGuard self-heal (the only RouterOS write):** HealthGuard periodically reads
`/rest/ip/service` and, if it detects the `www-ssl` REST service has gone down,
re-enables it with a single scoped `PATCH /rest/ip/service/{id}`. This is opt-out via
`MYLESNET_HEALTHGUARD_ENABLED=0` and rate-limited. The dashboard itself never writes
to RouterOS.

## Deployment

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOY_KEY=your_convex_deploy_key
CONVEX_SITE_URL=your_site_url

# WorkOS AuthKit SSO
WORKOS_CLIENT_ID=client_your_client_id_here
WORKOS_API_KEY=sk_test_your_api_key_here
WORKOS_COOKIE_PASSWORD=your_secure_password_here_must_be_at_least_32_characters_long
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3001/auth/callback
MYLESNET_PLATFORM_ORG_ID=org_your_platform_org_id_here
MYLESNET_BOOTSTRAP_OWNER_EMAILS=owner@example.com,second_owner@example.com
# Signing secret of the WorkOS webhook endpoint that syncs identity events into Convex.
WORKOS_WEBHOOK_SECRET=your_workos_webhook_signing_secret

# Base64-encoded 32-byte AES-256 keys (deployment environment only, never in source control)
ROUTER_CREDENTIALS_ENCRYPTION_KEY=
CENTIPID_CREDENTIALS_ENCRYPTION_KEY=

# Collector signing secret (shared with the local collector)
MYLESNET_COLLECTOR_SHARED_SECRET=
```

The Centipid MCP token and webhook signing secret are entered in the Centipid Settings
page and encrypted at rest; only `CENTIPID_CREDENTIALS_ENCRYPTION_KEY` is an env var.
The MCP token (`12|…`) is used solely by the operator's local opencode MCP client and
must never be set as an app env var or committed.

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts to deploy
4. Set environment variables in Vercel dashboard
5. Deploy to production: `vercel --prod`

### Deploy Convex Backend

1. Run: `npx convex deploy`
2. Verify deployment in Convex dashboard

Scheduled jobs (usage retention, voucher expiry sweep, Centipid reconciliation,
leaderboards, PII purge, telemetry rollups, healthguard staleness sweep, etc.) are
all code-defined in `convex/crons.ts` and are deployed and registered automatically
by `npx convex deploy`; there is no manual cron setup step. Health and usage sampling
itself is driven by the local collectors, not by cron.

## Development

### Run Locally

1. Install dependencies: `npm install`
2. Run Convex dev: `npx convex dev`
3. Run Next.js dev: `npm run dev`
4. Open: `http://localhost:3000`

### Database Schema

The Convex schema includes (representative, non-exhaustive):

**Network Operations:**
- `users` - User registry (sourced from WorkOS identity sync)
- `routers` - Router configuration
- `routerCredentials` - Encrypted credentials (server-side only)
- `accessPoints` - Access point registry
- `networkSwitches` - Switch registry behind each router
- `healthSamples` / `accessPointSamples` - Health monitoring data (per collector cycle)
- `usageSamples` - Usage statistics (180-day retention)
- `routerTelemetry` / `telemetryHourly` / `telemetryDaily` / `dailySnapshots` - Rolled-up telemetry
- `incidents` - Incident tracking
- `shiftNotes` - Operator notes
- `healthguardStates` / `device_commands` - Self-heal state and queued collector commands
- `configWatchBaselines` / `routerConfigurationSnapshots` - Configuration baselines and snapshots
- `dhcpLeases` / `simpleQueues` - Synced lease and queue state
- `activeHotspotSessions` - Current hotspot sessions

**Business & Platform:**
- `markets` / `agents` / `teams` - Operational structure
- `vouchers` / `voucherBatches` - Voucher tracking
- `commissions` / `payouts` / `expenses` - Money movement
- `marketFinancials` / `subscriberSnapshots` / `leaderboardSnapshots` - Reporting snapshots
- `auditLog` / `roles` - Audit trail and permission roles
- `supportTickets` / `scheduledReports` / `maintenanceWindows` - Operations

**Centipid Integration:**
- `centipidCredentials` - API token and webhook signing secret (server-side only)
- `subscriberEvents` / `paymentEvents` / `voucherEvents` / `ticketEvents` - Billing events
- `latestSubscriberState` / `ticketStatus` - Derived current state
- `webhookDeliveryLog` - Webhook delivery tracking (30-day retention)

## Security Notes

- RouterOS credentials are stored server-side and never exposed to clients
- All router communication happens via Convex server-side actions
- The dashboard backend is read-only against RouterOS; the only RouterOS write in the
  system is the collector's HealthGuard self-heal (scoped `www-ssl` re-enable, opt-out)
- Authentication is required for all dashboard access
- Shift notes must not contain customer PII or payment information
- Usage data is retained for 180 days only
- Centipid API token and webhook secret are stored server-side only
- All webhook payloads are HMAC-verified before processing
- Webhook delivery logs are pruned after 30 days to avoid PII accumulation
- The dashboard never writes back to Centipid - one-way integration only

## Troubleshooting

### Router Unreachable

If the dashboard shows "Router unreachable":
1. Verify the router's REST API service is enabled and accessible
2. Check the REST base URL and port are correct
3. Verify the monitoring account credentials are correct
4. Check network connectivity between Convex deployment and router
5. Review RouterOS firewall rules to ensure REST API access is allowed

### No Health Data

If health data isn't being collected:
1. Verify the collector is running for that router (`npm run collector:check` or the collector process)
2. Check router credentials are properly configured
3. Review the collector process logs and Convex function logs for errors
4. Ensure access points are registered with correct port names

### Certificate Validation Errors

If collection fails during TLS validation:
1. Confirm the router certificate is valid for the configured REST hostname or address.
2. Install the issuing CA certificate in the collector device trust store.
3. Run `npm run collector:check` again before starting continuous collection.

### Centipid Webhook Not Receiving Events

If webhooks aren't being received:
1. Verify the webhook URL in Centipid matches the URL shown in the dashboard
2. Verify the webhook signing secret matches between Centipid and the dashboard
   (both are saved in the Centipid Settings page; there is no Centipid env var)
3. Check the "Recent Webhook Deliveries" section in Centipid Settings for errors
4. Ensure the webhook is enabled for the correct event types in Centipid

### Centipid Historical Data Fails

If historical data backfill fails:
1. Verify the API token entered in the Centipid Settings page is valid (there is no Centipid env var)
2. Check the API token has the necessary permissions
3. Review Convex function logs for API errors
4. Verify the Centipid API is accessible from Convex deployment

## Support

For issues or questions:
- Check Convex dashboard logs for function errors
- Review RouterOS logs for REST API errors
- Verify network connectivity and firewall rules
- Ensure all RouterOS services are properly configured

## License

Internal operations tool for MylesCorp Technologies Ltd.
