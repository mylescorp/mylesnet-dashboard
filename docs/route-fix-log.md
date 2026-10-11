# Route fix log

| Timestamp (UTC) | Root cause | Branch | PR | Greptile | Production deploy | Verification |
|---|---|---|---|---|---|---|
| 2026-10-11 07:22 | Preserve incoming request host and local subdomain callback origin | `fix/routes-preserve-request-host` | Not opened: `gh auth status` reports invalid saved token | Pending | Not deployed | Typecheck passed; 182 tests passed; lint passed with 15 warnings; build passed; dependency audit blocked by registry DNS; port-3000 controlled run and production host verification remain blocked. See `docs/route-inventory.md`. |
