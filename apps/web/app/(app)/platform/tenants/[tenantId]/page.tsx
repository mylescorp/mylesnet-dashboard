import type { Metadata } from "next";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformTenantDetail } from "@/app/components/PlatformTenantDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return { title: `Tenant ${tenantId} · Platform` };
}

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requirePanelAccess("platform");
  const { tenantId } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformTenantDetail tenantId={tenantId} />
    </QueryErrorBoundary>
  );
}