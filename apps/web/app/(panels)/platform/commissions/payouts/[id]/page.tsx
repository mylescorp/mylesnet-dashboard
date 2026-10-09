import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPayoutDetail } from "@/platform/components/PlatformPayoutDetail";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const PAYOUT_ROLES = [
  "platform_super_admin", "platform_finance", "platform_owner", "platform_admin", "finance_manager",
];

export default async function PlatformPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, PAYOUT_ROLES)) redirect("/no-access");
  const { id } = await params;
  return <QueryErrorBoundary><PlatformPayoutDetail payoutId={id} /></QueryErrorBoundary>;
}
