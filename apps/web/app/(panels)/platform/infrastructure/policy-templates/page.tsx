import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPolicyTemplates } from "@/platform/components/PlatformPolicyTemplates";

export default async function PlatformPolicyTemplatesPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/infrastructure/policy-templates");
  return <QueryErrorBoundary><PlatformPolicyTemplates /></QueryErrorBoundary>;
}
