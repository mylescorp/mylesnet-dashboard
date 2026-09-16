import type { Metadata } from "next";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformFeatureFlagDetail } from "@/platform/components/PlatformFeatureFlagDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ flag: string }>;
}): Promise<Metadata> {
  const { flag } = await params;
  return { title: `Flag ${flag} · Platform` };
}

export default async function PlatformFeatureFlagDetailPage({
  params,
}: {
  params: Promise<{ flag: string }>;
}) {
  await requirePanelAccess("platform");
  const { flag } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformFeatureFlagDetail flag={decodeURIComponent(flag)} />
    </QueryErrorBoundary>
  );
}
