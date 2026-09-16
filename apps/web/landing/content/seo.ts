import type { Metadata } from "next";

/**
 * Canonical origin of the public site. Override with NEXT_PUBLIC_SITE_URL in
 * the deployment environment; the fallback is the production URL so builds
 * without env config still emit correct absolute URLs (metadataBase, sitemap,
 * robots, JSON-LD).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://mylesnetisp.mylescorptech.com";

type PageMetadataOptions = {
  /** Canonical path for the page, e.g. "/pricing" (resolved against SITE_URL). */
  canonical?: string;
  /** Suppress the "%s | MylesNet" template — for the home page's full title. */
  absoluteTitle?: boolean;
};

export function pageMetadata(
  title: string,
  description: string,
  options: PageMetadataOptions = {}
): Metadata {
  const { canonical, absoluteTitle } = options;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: absoluteTitle ? title : `${title} | MylesNet`,
      description,
      ...(canonical ? { url: canonical } : {}),
    },
  };
}
