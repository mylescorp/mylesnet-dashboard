/**
 * Tenant resolution from the request hostname (pure, node/browser-safe).
 *
 * Implements the DNS + panel-hostname plan: tenant panels live at
 * `[tenant].<domain>` while `/platform`, `/admin`, `/dashboard`, `/reseller`,
 * `/agency` and `/partner` panel hosts are `admin|network|dashboard|reseller|
 * agency|partner.<domain>`. The proxy uses these helpers to set the
 * `__mylesnet_tenant` cookie; the Convex layer re-derives the authoritative
 * tenant from WorkOS org membership, never from the URL alone.
 */

export const BOOTSTRAP_TENANT_SLUG = "mylesnet";
export const MYLESNET_PUBLIC_DOMAIN = "mylesnetisp.mylescorptech.com";

/** Reserved panel subdomains (canonical panel map, 99-mylesnet-orientation). */
export const PANEL_SUBDOMAINS = [
  "admin",
  "network",
  "dashboard",
  "reseller",
  "agency",
  "partner",
] as const;

export type PanelSubdomain = (typeof PANEL_SUBDOMAINS)[number];

export type MylesnetHost =
  | { kind: "apex" | "development"; hostname: string; port?: string }
  | { kind: "panel"; hostname: string; panel: PanelSubdomain }
  | { kind: "tenant"; hostname: string; tenantSlug: string }
  | { kind: "unknown"; hostname: string };

export const PANEL_SUBDOMAIN_SET: ReadonlySet<string> = new Set<string>(PANEL_SUBDOMAINS);

/** Tenant slug shape: 2-63 lowercase alphanumerics with optional single hyphens. */
export const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidTenantSlug(slug: string | undefined | null): slug is string {
  return typeof slug === "string" && slug.length >= 2 && slug.length <= 63 && TENANT_SLUG_RE.test(slug);
}

/**
 * Normalize a Host header/URL to a lowercase hostname without protocol, port
 * or a leading `www.` (e.g. `https://Admin.mylesnet.com:3000` -> `admin.mylesnet.com`).
 */
export function normalizeHost(host: string | undefined | null): string {
  if (!host) return "";
  let value = host.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/, 1)[0] ?? "";
  value = value.split(":", 1)[0] ?? "";
  value = value.toLowerCase();
  if (value.startsWith("www.")) value = value.slice(4);
  return value;
}

/** True when the host is a reserved panel host (`panel.<domain>`). */
export function isPanelHost(host: string | undefined | null): boolean {
  return resolveMylesnetHost(host).kind === "panel";
}

/**
 * Resolve a request host against the one approved product domain. This is an
 * allow-list, not a label-count heuristic: `evil.example.com` and nested
 * labels never become a tenant merely because they have three DNS labels.
 */
export function resolveMylesnetHost(
  host: string | undefined | null,
  baseDomain = MYLESNET_PUBLIC_DOMAIN,
): MylesnetHost {
  // `normalizeHost` preserves legacy behaviour by stripping `www.` for
  // display helpers. Authorization must not do that: `www` is not an
  // approved product host and must not borrow the apex callback URI.
  const rawValue = typeof host === "string"
    ? host.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/, 1)[0]?.toLowerCase() ?? ""
    : "";
  const [rawHostname, rawPort] = rawValue.split(":", 2);
  const port = rawPort && /^\d+$/.test(rawPort) ? rawPort : undefined;
  if (rawHostname?.startsWith("www.")) return { kind: "unknown", hostname: rawHostname };
  const hostname = normalizeHost(host);
  if (!hostname) return { kind: "unknown", hostname };
  if (hostname === "localhost" || /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(hostname)) {
    // Development callbacks must keep the port so `localhost:3000` matches the
    // redirect URIs registered in WorkOS rather than collapsing to `localhost`.
    return port ? { kind: "development", hostname, port } : { kind: "development", hostname };
  }
  const base = normalizeHost(baseDomain);
  if (!base || hostname === base) return hostname === base
    ? { kind: "apex", hostname }
    : { kind: "unknown", hostname };
  const suffix = `.${base}`;
  if (!hostname.endsWith(suffix)) return { kind: "unknown", hostname };
  const label = hostname.slice(0, -suffix.length);
  // WorkOS wildcard redirects and our tenancy contract intentionally support
  // exactly one label before the registered product domain.
  if (!label || label.includes(".")) return { kind: "unknown", hostname };
  if (PANEL_SUBDOMAIN_SET.has(label)) return { kind: "panel", hostname, panel: label as PanelSubdomain };
  if (isValidTenantSlug(label) && !/^\d+$/.test(label)) return { kind: "tenant", hostname, tenantSlug: label };
  return { kind: "unknown", hostname };
}

/** Return the only callback URI that may be supplied to AuthKit for a host. */
export function callbackUriForHost(host: MylesnetHost, protocol = "https:"): string | null {
  if (host.kind === "unknown") return null;
  const safeProtocol = host.kind === "development" ? protocol : "https:";
  const port = host.kind === "development" && host.port ? `:${host.port}` : "";
  return `${safeProtocol}//${host.hostname}${port}/auth/callback`;
}

/** True when the host has no tenant subdomain (apex, `localhost`, bare IP). */
export function isApexHost(host: string | undefined | null): boolean {
  const resolved = resolveMylesnetHost(host);
  return resolved.kind === "apex" || resolved.kind === "development" || resolved.kind === "panel";
}

/**
 * Resolve the tenant slug from a hostname. Returns null when there is no
 * tenant subdomain (panel host, apex with <=2 labels, `localhost`, bare IP,
 * numeric/malformed label) — callers fall back to the bootstrap slug
 * (`mylesnet`) for the pre-migration dashboard.
 */
export function tenantSlugFromHost(host: string | undefined | null): string | null {
  const resolved = resolveMylesnetHost(host);
  return resolved.kind === "tenant" ? resolved.tenantSlug : null;
}
