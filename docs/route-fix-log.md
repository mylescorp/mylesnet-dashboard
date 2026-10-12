# Route fix log

| Timestamp (UTC) | Root cause | Branch | PR | Greptile | Production deploy | Verification |
|---|---|---|---|---|---|---|
| 2026-10-11 07:22 | Preserve incoming request host and local subdomain callback origin | `fix/routes-preserve-request-host` | Not opened: `gh auth status` reports invalid saved token | Pending | Not deployed | Typecheck passed; 182 tests passed; lint passed with 15 warnings; build passed; dependency audit blocked by registry DNS; port-3000 controlled run and production host verification remain blocked. See `docs/route-inventory.md`. |
| 2026-10-11 08:08 | Guard React Server Component performance tracks against invalid negative timestamps during aborted or errored rendering | `fix/routes-negative-rsc-timestamp` | Pending | Pending | Not deployed | Typecheck passed; 31 tests passed; lint passed with 15 existing warnings; build passed; dependency audit blocked by registry DNS; controlled local verification blocked because port 3000 is occupied. |

Correction recorded 2026-10-11: PR #82 (`fix/routes-preserve-request-host`) was opened, reached Greptile 5/5 per owner report, and is now present on `origin/main` as `afcdcb0`. The earlier row's PR and review fields were stale when it was written.
