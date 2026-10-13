import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPaymentGateways } from "@/platform/components/PlatformPaymentGateways";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const PAYMENT_SETTINGS_ROLES = ["platform_super_admin", "platform_owner", "platform_finance", "finance_manager"];

export default async function PlatformPaymentSettingsPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, PAYMENT_SETTINGS_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformPaymentGateways /></QueryErrorBoundary>;
}
