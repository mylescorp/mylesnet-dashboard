import { requirePanelAccess } from "@/lib/auth/panels";

/**
 * Server-side Platform (control plane) boundary. Entry is denied for any user
 * without a Platform role before any Platform data query is mounted. The
 * control-plane sub-surfaces live in the single, shared app shell; no second
 * chrome is rendered here.
 */
export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePanelAccess("platform");
  return children;
}