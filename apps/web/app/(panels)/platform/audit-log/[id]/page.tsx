import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformAuditEntry } from "@/platform/components/PlatformAuditEntry";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";

export default async function PlatformAuditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelAccess("platform");
  const { id } = await params;
  return <QueryErrorBoundary><PlatformAuditEntry auditId={id} /></QueryErrorBoundary>;
}
