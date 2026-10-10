import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { NewOrganizationForm } from "@/platform/components/NewOrganizationForm";
import { requireUser } from "@/shared/auth/session";
import { canSeePlatformNavRoute } from "@/shared/navigation/platform-nav-access";
import { redirect } from "next/navigation";

export default async function NewOrganizationPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!canSeePlatformNavRoute("/platform/organizations/new", session.roleSlugs)) redirect("/no-access");
  return (
    <QueryErrorBoundary>
      <NewOrganizationForm />
    </QueryErrorBoundary>
  );
}
