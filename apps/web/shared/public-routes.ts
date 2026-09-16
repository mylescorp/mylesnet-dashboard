import { features, solutions } from "@/landing/content/pages";
import { guides } from "@/landing/content/guides";

/**
 * Every path an anonymous visitor must be able to reach without a session.
 *
 * Derived from the landing content modules so a new feature, solution, or
 * guide is automatically public (and in the sitemap) when it is added —
 * the same route list drives the auth proxy and sitemap.xml.
 */
export const PUBLIC_PATHS: string[] = [
  // Auth surfaces
  "/signin",
  "/auth/callback",

  // Marketing home
  "/",

  // Platform
  "/product",
  "/pricing",
  "/integrations",
  "/security",
  "/customers",

  // Features
  "/features",
  ...features.map((feature) => `/features/${feature.slug}`),

  // Solutions
  "/solutions",
  ...solutions.map((solution) => `/solutions/${solution.slug}`),

  // Resources
  "/resources",
  "/resources/how-it-works",
  ...guides.map((guide) => `/resources/${guide.slug}`),

  // Company & legal
  "/company/about",
  "/legal/privacy",
  "/legal/terms",

  // Conversion
  "/get-started",
  "/contact",

  // Legacy compat redirects
  "/landing",
  "/landing/get-started",
];
