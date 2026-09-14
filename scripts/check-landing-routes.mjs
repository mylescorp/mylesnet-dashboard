import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const landingRouteFiles = [
  "page.tsx",
  "company/about/page.tsx",
  "contact/page.tsx",
  "customers/page.tsx",
  "features/page.tsx",
  "features/[slug]/page.tsx",
  "get-started/page.tsx",
  "integrations/page.tsx",
  "landing/page.tsx",
  "landing/get-started/page.tsx",
  "legal/privacy/page.tsx",
  "legal/terms/page.tsx",
  "pricing/page.tsx",
  "product/page.tsx",
  "resources/page.tsx",
  "resources/how-it-works/page.tsx",
  "resources/[slug]/page.tsx",
  "security/page.tsx",
  "solutions/page.tsx",
  "solutions/[slug]/page.tsx",
];

const root = resolve("apps/web/app/(landing)");
const missing = [];

for (const routeFile of landingRouteFiles) {
  try {
    await access(resolve(root, routeFile), constants.R_OK);
  } catch {
    missing.push(routeFile);
  }
}

if (missing.length) {
  throw new Error(`Missing required landing routes: ${missing.join(", ")}`);
}

console.log(`Landing route contract passed: ${landingRouteFiles.length} routes are present.`);
