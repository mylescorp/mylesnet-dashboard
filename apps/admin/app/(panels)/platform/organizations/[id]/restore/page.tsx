import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { PlatformTenantLifecycleAction } from "@/platform/components/PlatformTenantLifecycleAction";
export default async function RestorePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformRouteAccess("/platform/organizations/[id]/restore");
  const { id } = await params;
  return <PlatformTenantLifecycleAction tenantId={id} action="restore" />;
}
