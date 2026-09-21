import { requirePanelAccess } from "./panels";

/**
 * Server-side boundary for every tenant-workspace route that is exposed at a
 * root URL. Convex remains the authority for data and mutations, where the
 * active WorkOS organization is resolved to the tenant membership again.
 */
export default async function TenantPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePanelAccess("dashboard");
  return children;
}
