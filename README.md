# MylesNet Network Operations Dashboard

A cloud-based network operations dashboard for monitoring multiple MikroTik routers from any device. This tool provides read-only monitoring of WiFi hotspot operations, router health, access point status, and usage statistics.

## Security Architecture

**CRITICAL SECURITY DESIGN**: RouterOS credentials are NEVER exposed to the browser or client-side code. All router communication happens server-side through Convex actions that read credentials from the database and make authenticated requests to RouterOS REST APIs.

- Credentials are stored server-side only in the Convex `routerCredentials` table
- The browser never receives router credentials in any query result
- All RouterOS REST API calls happen via Convex scheduled actions running server-side
- The Next.js frontend talks ONLY to Convex (queries/mutations/subscriptions)

## Features

- **Multi-Router Support**: Monitor multiple routers/markets from a single dashboard
- **Live Dashboard**: Real-time view of connected users, router health, and access point status
- **Service Assurance**: Automatic health sampling every 30 seconds (CPU, memory, link state, traffic, errors)
- **Incident Tracking**: Automatic incident creation for link failures, high CPU, and router unreachability
- **Shift Notes**: Operator notes for handover and operational context
- **Usage Reporting**: Per-user and per-access-point usage statistics with CSV export
- **Configuration Watch**: Baseline configuration tracking to detect unexpected changes
- **Read-Only Operations**: Zero RouterOS write actions - monitoring only, no configuration changes

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
5. Ensure the service is accessible from the internet/network where your Convex deployment runs

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

The dashboard supports both self-signed and proper TLS certificates:

**For Self-Signed Certificates (Current Setup)**:
- The system will handle self-signed certificates by default
- This is acceptable for internal monitoring tools
- Document this trade-off in your security policies

**For Production Certificates (Recommended)**:
- Generate a proper TLS certificate for your router
- Import the certificate into RouterOS
- Use the certificate for the www-ssl service
- This provides better security and prevents man-in-the-middle attacks

### Step 4: Add Router to Dashboard

1. Sign in to the MylesNet Dashboard
2. Navigate to "Manage Routers"
3. Click "Add Router"
4. Fill in the required information:
   - **Router Name**: e.g., "Tayari Router"
   - **Location**: e.g., "Tayari Market"
   - **REST Base URL**: e.g., `https://192.168.1.1:8443` (include port)
   - **RouterOS Username**: The dedicated monitoring account username
   - **RouterOS Password**: The dedicated monitoring account password

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
   - Router health data is being collected (CPU, memory)
   - Access points show correct link status
   - Active hotspot sessions are being counted
   - Health samples are being written every 30 seconds

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

- `users` - Managed by Convex Auth
- `routers` - Router configuration
- `routerCredentials` - Encrypted credentials (server-side only)
- `accessPoints` - Access point registry
- `healthSamples` - Health monitoring data (30-second intervals)
- `usageSamples` - Usage statistics (60-second intervals, 180-day retention)
- `incidents` - Incident tracking
- `shiftNotes` - Operator notes
- `configWatchBaselines` - Configuration baselines

## Security Notes

- RouterOS credentials are stored server-side and never exposed to clients
- All router communication happens via Convex server-side actions
- The dashboard is read-only - no RouterOS write operations
- Authentication is required for all dashboard access
- Shift notes must not contain customer PII or payment information
- Usage data is retained for 180 days only

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

If you see certificate validation errors:
1. For self-signed certificates, this is expected and handled
2. For production, use proper TLS certificates on routers
3. Verify the certificate chain is valid

## Support

For issues or questions:
- Check Convex dashboard logs for function errors
- Review RouterOS logs for REST API errors
- Verify network connectivity and firewall rules
- Ensure all RouterOS services are properly configured

## License

Internal operations tool for MylesCorp Technologies Ltd.
