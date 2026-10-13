import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { NewOrganizationForm } from "@/platform/components/NewOrganizationForm";

export default async function NewOrganizationPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <NewOrganizationForm />
    </QueryErrorBoundary>
  );
}