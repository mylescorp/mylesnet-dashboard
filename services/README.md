# services/

Private network-plane services (per `docs/technology-stack.md` Monorepo Shape).
Skeletons only — no runtime code yet. These run on AWS ECS Fargate, never in the
browser, and are the only actors that may reach router/RADIUS secrets.

- `network-worker/` — Go device + RADIUS-control worker (RouterOS API, SNMP, SSH,
  provisioning, CoA/Disconnect, backups, telemetry).
- `radius/` — FreeRADIUS 3.x configuration, modules, dictionaries, and committed
  test fixtures (Request → Expected Response).
- `communications/` — tenant-selected SMS/email provider adapter gateway.
