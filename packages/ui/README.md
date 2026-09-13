# @mylesnet/ui

Shared shadcn/ui + Radix UI primitives (per `docs/technology-stack.md` Monorepo
Shape). Skeletons only — no runtime code yet. UI/API divergence is blocked at the
type level; components must not hardcode palette values (use the design-token
contract enforced by `tokens:check`).
