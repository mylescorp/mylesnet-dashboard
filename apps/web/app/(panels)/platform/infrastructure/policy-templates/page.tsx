import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPolicyTemplates } from "@/platform/components/PlatformPolicyTemplates";

export default async function PlatformPolicyTemplatesPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformPolicyTemplates /></QueryErrorBoundary>;
}
