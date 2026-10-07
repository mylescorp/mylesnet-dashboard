import { features, solutions } from "@/landing/content/pages";
import { guides } from "@/landing/content/guides";
import { releases } from "@/landing/content/changelog";
import { posts } from "@/landing/content/blog";
import { countries } from "@/landing/content/countries";
import { comparisons } from "@/landing/content/comparisons";

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

  // Self-service sign-up wizard
  "/signup",
  "/api/signup/start",

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

  // Free tools (no account needed)
  "/speedtest",
  "/what-is-my-ip",
  "/bandwidth-calculator",
  "/subnet-calculator",
  "/demo",

  // Comparison pages
  "/vs",
  ...comparisons.map((comparison) => `/vs/${comparison.slug}`),

  // Country guides
  "/country",
  ...countries.map((country) => `/country/${country.slug}`),

  // Publishing surfaces
  "/docs",
  "/academy",
  "/blog",
  ...posts.map((post) => `/blog/${post.slug}`),
  "/changelog",
  ...releases.map((release) => `/changelog/${release.slug}`),

  // The speed test measures against this endpoint
  "/api/speedtest",

  // Company & legal
  "/company",
  "/company/about",
  "/company/mylescorp",
  "/legal/privacy",
  "/legal/terms",
  "/legal/affiliate-policy",

  // Conversion
  "/get-started",
  "/contact",
  "/become-an-affiliate",
  "/shop",
  "/book-a-call",

  // Legacy compat redirects
  "/landing",
  "/landing/get-started",
];
