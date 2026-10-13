import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { PlatformTenantLifecycleAction } from "@/platform/components/PlatformTenantLifecycleAction";
export default async function SuspendPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformRouteAccess("/platform/organizations/[id]/suspend");
  const { id } = await params;
  return <PlatformTenantLifecycleAction tenantId={id} action="suspend" />;
}
