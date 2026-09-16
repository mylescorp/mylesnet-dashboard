# Legacy retirement manifest

## Retired source surface

The following implementation is removed: local collector, direct RouterOS
monitoring, routers/access points/switch monitoring, telemetry, HealthGuard,
configuration watch, device commands, monitoring alerts/incidents/capacity,
and the Centipid integration.

## Retained product surface

Tenant identity and membership, WorkOS authorization, tenant lifecycle,
entitlements, subscribers, plans, expenses, payments/revenue records,
vouchers, commissions, support, reporting, audit, and the future RADIUS and
connector contracts remain in scope.

## Production data gate

Before applying the schema deletion to any Convex deployment, an operator must:

1. Verify the exact target deployment and export the retired-table data to the
   approved encrypted vault.
2. Record the export hash, table manifest, retention expiry, and approval.
3. Retain the export for 90 days, then purge it only with a dated approval.

No deployment or data deletion is performed by this repository change.
