# MylesNet Network Operations Dashboard

A network operations dashboard for monitoring multiple MikroTik routers. This tool provides read-only monitoring of WiFi hotspot operations, router health, access point status, and usage statistics.

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
4. Set `MYLESNET_COLLECTOR_ROUTER_ID` to the router identifier shown in the dashboard. The collector securely obtains that router's saved read-only connection on each collection cycle.
5. Run `npm run collector:check` once. It exits successfully only after the router read and dashboard delivery both succeed.
6. Start continuous collection with `npm run collector:start`.

For this local operations workstation, use `npm run collector:local:check` and then `npm run collector:local`. These commands obtain the signing secret from the protected production configuration at runtime rather than storing it in `collector/.env.local`.

The collector reads `/system/resource`, `/interface`, `/ip/hotspot/active`, `/ip/pool`, `/ip/dns`, and `/ip/route`. It does not issue RouterOS write requests or external traffic tests.

## Features

- **Multi-Router Support**: Monitor multiple routers/markets from a single dashboard
- **Live Dashboard**: Real-time view of connected users, router health, and access point status
- **Service Assurance**: Automatic health sampling every 30 seconds (CPU, memory, link state, traffic, errors)
- **Incident Tracking**: Automatic incident creation for link failures, high CPU, and router unreachability
- **Shift Notes**: Operator notes for handover and operational context
- **Usage Reporting**: Per-user and per-access-point usage statistics with CSV export
- **Configuration Watch**: Baseline configuration tracking to detect unexpected changes
- **Read-Only Operations**: Zero RouterOS write actions - monitoring only, no configuration changes
- **Centipid Integration**: Real-time business event tracking (subscribers, payments, vouchers, tickets) via webhooks
- **Business Activity Feed**: Live feed of billing events from Centipid with filtering capabilities
- **Connected User Count**: Real-time hotspot session tracking from RouterOS

## Tech Stack

- **Frontend**: Next.js 16.3 with TypeScript and Tailwind CSS v4
- **Backend**: Convex (database, scheduled functions, server-side actions)
- **Authentication**: Convex Auth with Password provider (email + password only)
- **Hosting**: Vercel (frontend) + Convex (backend)

## Router Onboarding Guide

### Step 1: Enable RouterOS REST API

On your MikroTik router, enable the REST API service:

1. Access your router via Winbox, SSH, or the web interface
2. Navigate to `IP` → `Services`
3. Find `www-ssl` and enable it
4. Set the port to `8443` (or your preferred HTTPS port)
5. Ensure the service is accessible from the local collector device. Do not expose the router REST service to the public internet.

### Step 2: Create Dedicated Read-Only Account

**RECOMMENDED**: Create a dedicated RouterOS account with only `read` and `rest-api` permissions:

```routeros
# Create a dedicated monitoring user
/user add name=mylesnet_monitor group=read password=YOUR_SECURE_PASSWORD

# Alternatively, create a custom group with specific permissions
/user group add name=mylesnet_monitoring policy=ftp,reboot,read,test,winbox,api,local,telnet,ssh,webfig,sensitive
```

**IMPORTANT**: This account should have:
- `read` permission only (no write access)
- `rest-api` access enabled
- A strong, unique password
- No access to sensitive configuration changes

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
   - Health samples are being written every 30 seconds
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

The dashboard only calls these read-only RouterOS REST endpoints:

- `/ip/hotspot/active` - Active hotspot sessions
- `/interface/bridge/host` - Bridge host information (MAC-to-port mapping)
- `/system/resource` - System resources (CPU, memory)
- `/interface` - Interface information
- `/ip/pool` - IP pool configuration
- `/ip/pool/used` - IP pool usage
- `/ip/route` - Routing table
- `/ip/dns` - DNS resolver configuration

**IMPORTANT**: The dashboard never calls any write operations or configuration-changing endpoints.

## Deployment

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOY_KEY=your_convex_deploy_key

# Convex Auth
AUTH_SECRET=your_auth_secret
CONVEX_SITE_URL=your_site_url

# Centipid Integration
CENTIPID_CREDENTIALS_ENCRYPTION_KEY=your_base64_32_byte_key
CENTIPID_MCP_TOKEN=12|your_mcp_token
```

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts to deploy
4. Set environment variables in Vercel dashboard
5. Deploy to production: `vercel --prod`

### Deploy Convex Backend

1. Run: `npx convex deploy`
2. Verify deployment in Convex dashboard
3. Set up cron jobs for health and usage collection

## Development

### Run Locally

1. Install dependencies: `npm install`
2. Run Convex dev: `npx convex dev`
3. Run Next.js dev: `npm run dev`
4. Open: `http://localhost:3000`

### Database Schema

The Convex schema includes:

**Network Operations:**
- `users` - Managed by Convex Auth
- `routers` - Router configuration
- `routerCredentials` - Encrypted credentials (server-side only)
- `accessPoints` - Access point registry
- `healthSamples` - Health monitoring data (30-second intervals)
- `usageSamples` - Usage statistics (60-second intervals, 180-day retention)
- `incidents` - Incident tracking
- `shiftNotes` - Operator notes
- `configWatchBaselines` - Configuration baselines

**Centipid Integration:**
- `centipidCredentials` - API token and webhook signing secret (server-side only)
- `subscriberEvents` - Subscriber lifecycle events
- `paymentEvents` - Payment events
- `voucherEvents` - Voucher events
- `ticketEvents` - Support ticket events
- `webhookDeliveryLog` - Webhook delivery tracking (30-day retention)

## Security Notes

- RouterOS credentials are stored server-side and never exposed to clients
- All router communication happens via Convex server-side actions
- The dashboard is read-only - no RouterOS write operations
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
1. Verify cron jobs are running in Convex dashboard
2. Check router credentials are properly configured
3. Review Convex function logs for errors
4. Ensure access points are registered with correct port names

### Certificate Validation Errors

If collection fails during TLS validation:
1. Confirm the router certificate is valid for the configured REST hostname or address.
2. Install the issuing CA certificate in the collector device trust store.
3. Run `npm run collector:check` again before starting continuous collection.

### Centipid Webhook Not Receiving Events

If webhooks aren't being received:
1. Verify the webhook URL in Centipid matches the URL shown in the dashboard
2. Check the webhook signing secret matches between Centipid and the dashboard
3. Verify CENTIPID_WEBHOOK_SECRET environment variable is set in Convex
4. Check the "Recent Webhook Deliveries" section in Centipid Settings for errors
5. Ensure the webhook is enabled for the correct event types in Centipid

### Centipid Historical Data Fails

If historical data backfill fails:
1. Verify CENTIPID_API_TOKEN environment variable is set in Convex
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
