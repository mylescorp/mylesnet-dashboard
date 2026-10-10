import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { PlatformWhiteLabelDefaults } from "@/platform/components/PlatformWhiteLabelDefaults";

export default async function PlatformWhiteLabelPage() {
  await requirePlatformRouteAccess("/platform/settings/white-label");
  return <PlatformWhiteLabelDefaults />;
}
