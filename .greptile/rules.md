# Mandatory review rules

- Every Convex query and mutation enforces tenant isolation. A cross-tenant platform operation must use the server-side platform-role policy.
- Authorization is the first action in every Convex function.
- Every role/action cell not explicitly granted in `PLATFORM_SUB_ROLE_MAP` is denied.
- Never expose secrets or environment values anywhere.
- User-facing output never exposes technology-stack, provider, implementation, or path details. Translate every failure through the shared safe error boundary.
- Never use mock, placeholder, sample, fabricated, or hardcoded business data.
- Every mutation writes an audit entry. Exclude secrets and sensitive payloads from audit details.
- Preserve mandatory MFA and session rules: 30 minutes inactivity, warning at 25 minutes, and 12 hours absolute lifetime.
- Add no runtime dependency outside `docs/technology-stack.md`.
