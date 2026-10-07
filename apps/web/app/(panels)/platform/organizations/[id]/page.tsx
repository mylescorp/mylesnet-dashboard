import type { Metadata } from "next";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantDetail } from "@/platform/components/PlatformTenantDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Organization ${id} · Platform` };
}

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelAccess("platform");
  const { id } = await params;
  return <QueryErrorBoundary><PlatformTenantDetail tenantId={id} /></QueryErrorBoundary>;
}
