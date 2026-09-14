# services/communications

Target for the tenant-selected SMS/email provider adapter gateway. Skeleton only
— no code yet. Providers sit behind one idempotent adapter contract; swapping a
provider must not change the call path or tenant data model; provider credentials
are tenant-scoped secrets. See `docs/technology-stack.md` (Communications adapters).
