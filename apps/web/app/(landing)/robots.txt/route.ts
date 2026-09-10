import { NextResponse } from "next/server";

const ROBOTS_TXT = `User-Agent: *
Allow: /

Sitemap: https://mylesnetisp.mylescorptech.com/sitemap.xml
`;

export function GET() {
  return new NextResponse(ROBOTS_TXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}