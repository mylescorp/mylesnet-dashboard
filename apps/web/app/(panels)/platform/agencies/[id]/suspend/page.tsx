import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { requireUser } from "@/shared/auth/session";
import { hasAnyRole } from "@/shared/auth/rbac";
import { PlatformPartnerLifecycle } from "@/platform/components/PlatformPartnerLifecycle";

export default async function SuspendAgencyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, ["platform_super_admin", "platform_owner", "platform_admin"])) redirect("/no-access");
  const { id } = await params;
  return <PlatformPartnerLifecycle id={id} action="suspend" />;
}
