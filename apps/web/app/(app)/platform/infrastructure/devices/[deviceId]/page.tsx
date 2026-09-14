import type { Metadata } from "next";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformDeviceDetail } from "@/app/components/PlatformDeviceDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}): Promise<Metadata> {
  const { deviceId } = await params;
  return { title: `Device ${deviceId} · Platform` };
}

export default async function PlatformDeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  await requirePanelAccess("platform");
  const { deviceId } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformDeviceDetail deviceId={deviceId} />
    </QueryErrorBoundary>
  );
}