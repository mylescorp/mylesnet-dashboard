import { requirePanelAccess } from "@/lib/auth/panels";

/**
 * Server-side tenant app boundary. Client components may render the dashboard,
 * but entry is denied before any dashboard data query is mounted.
 */
export default async function TenantDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePanelAccess("dashboard");
  return children;
}
