import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPayouts } from "@/platform/components/PlatformPayouts";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const PAYOUT_ROLES = [
  "platform_super_admin", "platform_finance", "platform_owner", "platform_admin", "finance_manager",
];

export default async function PlatformPayoutsPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, PAYOUT_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformPayouts /></QueryErrorBoundary>;
}
