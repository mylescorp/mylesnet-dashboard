import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { PlatformCommissionRates } from "@/platform/components/PlatformCommissionRates";

const RATE_ROLES = ["platform_super_admin", "platform_finance", "platform_owner", "platform_admin", "finance_manager"];
export default async function PlatformCommissionRatesPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, RATE_ROLES)) redirect("/no-access");
  return <PlatformCommissionRates />;
}
