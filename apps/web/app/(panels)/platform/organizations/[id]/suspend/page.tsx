import { PlatformTenantLifecycleAction } from "@/platform/components/PlatformTenantLifecycleAction";
export default async function SuspendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformTenantLifecycleAction tenantId={id} action="suspend" />;
}
