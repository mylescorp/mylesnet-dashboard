import { getActiveTenantSlug, requireUser } from "@/lib/auth/session";

/**
 * A server-rendered protected route that exercises the AuthKit DAL. The
 * hostname-derived tenant value is deliberately labeled as an advisory hint:
 * Convex derives its authoritative tenant scope from WorkOS membership.
 */
export default async function AccountPage() {
  const [session, tenantHint] = await Promise.all([requireUser(), getActiveTenantSlug()]);

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="page-title">Signed-in session</h1>
          <p className="page-subtitle">Your workforce identity and hostname context.</p>
        </div>
      </header>
      <section className="workspace-card">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="pf-muted">Email</dt><dd>{session.email ?? "Not provided by the identity provider"}</dd></div>
          <div><dt className="pf-muted">WorkOS organization</dt><dd>{session.orgId ?? "No organization claim"}</dd></div>
          <div><dt className="pf-muted">Roles</dt><dd>{session.roleSlugs.join(", ") || "No role claims"}</dd></div>
          <div><dt className="pf-muted">Hostname tenant hint</dt><dd>{tenantHint}</dd></div>
        </dl>
      </section>
    </main>
  );
}
