import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchQuery } from "convex/nextjs";
import { forbidden, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { requirePanelAccess } from "@/lib/auth/panels";

/**
 * Server-side tenant app boundary. Client components may render the dashboard,
 * but entry is denied before any dashboard data query is mounted.
 */
export default async function TenantDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePanelAccess("dashboard");

  const { accessToken } = await withAuth();
  if (!accessToken) redirect("/no-access");

  const workspace = await fetchQuery(
    api.tenantControl.getCurrentWorkspace,
    {},
    { token: accessToken },
  );
  if (workspace.status === "setup_required" && workspace.reason === "tenant_suspended") {
    forbidden();
  }

  return children;
}
