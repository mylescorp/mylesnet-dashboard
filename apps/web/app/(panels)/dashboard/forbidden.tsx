export default function DashboardForbidden() {
  return (
    <main className="workspace-page" aria-labelledby="dashboard-forbidden-title">
      <section className="workspace-card tenant-workspace-summary" role="alert">
        <p className="eyebrow">HTTP 403</p>
        <h1 id="dashboard-forbidden-title">Workspace access is suspended</h1>
        <p>
          This organization is temporarily unavailable. Contact your service provider for help.
        </p>
      </section>
    </main>
  );
}
