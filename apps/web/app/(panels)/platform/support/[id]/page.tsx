import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSupportTicketDetail } from "@/platform/components/PlatformSupportTicketDetail";

export default async function PlatformSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelAccess("platform");
  const { id } = await params;
  return <QueryErrorBoundary><PlatformSupportTicketDetail ticketId={id} /></QueryErrorBoundary>;
}
