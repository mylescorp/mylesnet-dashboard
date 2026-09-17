import { requirePanelAccess } from "@/shared/auth/panels";

/** Access administration belongs to the platform control plane. */
export default async function AccessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePanelAccess("platform");
  return children;
}
