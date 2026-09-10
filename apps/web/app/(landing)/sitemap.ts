import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://mylesnetisp.mylescorptech.com";
  const staticRoutes = [
    "",
    "/pricing",
    "/get-started",
    "/resources/how-it-works",
    "/company/about",
    "/legal/privacy",
    "/legal/terms",
    "/features/customer-management",
    "/features/packages-vouchers",
    "/features/payments-finance",
    "/features/network-operations",
    "/features/support-communications",
    "/solutions/market-hotspots",
    "/solutions/estate-networks",
    "/solutions/hospitality",
    "/solutions/community-networks",
  ];
  return staticRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.8,
  }));
}