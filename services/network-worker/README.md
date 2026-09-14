# services/network-worker

Target for the Go network worker: RouterOS API, SNMP, SSH, provisioning,
CoA/Disconnect, backups, and telemetry. Skeleton only — no code yet. Workers are
the only actors with router/RADIUS secrets; they pull credentials from Secrets
Manager at startup and on rotation, and every job is idempotent (job-id upsert,
verifed result). See `docs/technology-stack.md` (Network automation — Go workers).
