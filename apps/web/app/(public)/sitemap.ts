import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { SITE_URL } from "@/landing/content/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const legacyRedirects = ["/landing", "/landing/get-started"];
  return PUBLIC_PATHS.filter(
    (route) => !legacyRedirects.includes(route)
  ).map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));
}
