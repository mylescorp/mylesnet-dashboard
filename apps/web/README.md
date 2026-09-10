# apps/web

Target location for the Next.js web application (Platform, Admin, Dashboard incl.
subscriber portal, and Reseller panels) per the monorepo shape in
`docs/technology-stack.md`.

The application currently lives at the repository root (`app/`, `public/`,
`proxy.ts`, `next.config.ts`, etc.) as the pre-monorepo state. Relocating it into
this package is a deploy-gated checkpoint (see `products/mylesnet/tasks/backlog.md`
Phase 0 — pnpm + Turborepo monorepo conversion).
