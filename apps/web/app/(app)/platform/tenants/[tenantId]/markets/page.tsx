import type { Metadata } from "next";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformTenantMarkets } from "@/app/components/PlatformTenantMarkets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return { title: `Markets · Tenant ${tenantId} · Platform` };
}

export default async function PlatformTenantMarketsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requirePanelAccess("platform");
  const { tenantId } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformTenantMarkets tenantId={tenantId} />
    </QueryErrorBoundary>
  );
}