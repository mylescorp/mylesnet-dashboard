import { PlatformMarkets } from "@/platform/components/PlatformMarkets";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformMarkets tenantId={id} />;
}
