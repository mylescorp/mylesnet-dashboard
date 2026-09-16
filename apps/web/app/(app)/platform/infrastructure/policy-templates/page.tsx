import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformPolicyTemplates } from "@/app/components/PlatformPolicyTemplates";

export default async function PlatformPolicyTemplatesPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformPolicyTemplates />
    </QueryErrorBoundary>
  );
}
