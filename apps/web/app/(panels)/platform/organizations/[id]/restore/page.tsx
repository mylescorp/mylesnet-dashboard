import { PlatformTenantLifecycleAction } from "@/platform/components/PlatformTenantLifecycleAction";
export default async function RestorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformTenantLifecycleAction tenantId={id} action="restore" />;
}
