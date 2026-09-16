import { NextResponse } from "next/server";
import { SITE_URL } from "@/landing/content/seo";

export function GET() {
  const ROBOTS_TXT = `User-Agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new NextResponse(ROBOTS_TXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
