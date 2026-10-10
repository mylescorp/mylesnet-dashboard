import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { requireUser } from "@/shared/auth/session";
import { hasAnyRole } from "@/shared/auth/rbac";
import { PlatformPartnerRegistry } from "@/platform/components/PlatformPartnerRegistry";

export default async function PlatformAgenciesPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"])) redirect("/no-access");
  return <PlatformPartnerRegistry type="agency" />;
}
