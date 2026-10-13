import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformDeviceDetail } from "@/platform/components/PlatformDeviceDetail";

export default async function PlatformDeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  await requirePanelAccess("platform");
  const { deviceId } = await params;
  return <QueryErrorBoundary><PlatformDeviceDetail deviceId={deviceId} /></QueryErrorBoundary>;
}
