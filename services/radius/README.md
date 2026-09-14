# services/radius

Target for FreeRADIUS 3.x: config, modules, dictionaries, and committed test
fixtures (Request → Expected Response) run in CI before AAA releases. Skeleton
only — no config yet. AAA reads policy from PostgreSQL policy replicas (local
auth path) so subscriber access does not depend on Convex/Vercel. See
`docs/technology-stack.md` (AAA plane — FreeRADIUS).
