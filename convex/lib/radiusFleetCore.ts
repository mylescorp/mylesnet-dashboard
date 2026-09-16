/**
 * Pure helpers for the platform RADIUS server fleet (spec B3).
 *
 * FreeRADIUS 3.x runs active-active nodes; shared RADIUS node records are
 * platform-owned (no tenant scope). Everything here is deterministic and
 * free of Convex I/O so it can be unit-tested in isolation.
 */

export type RadiusServerStatus =
  | "active"
  | "provisioning"
  | "failed"
  | "maintenance"
  | "decommissioned";

export type RadiusServerProtocol = "radsec" | "udp";

export type RadiusHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export const RADIUS_SERVER_STATUSES: readonly RadiusServerStatus[] = [
  "active",
  "provisioning",
  "failed",
  "maintenance",
  "decommissioned",
];

export const RADIUS_SERVER_PROTOCOLS: readonly RadiusServerProtocol[] = [
  "radsec",
  "udp",
];

export const RADIUS_HEALTH_STATUSES: readonly RadiusHealthStatus[] = [
  "healthy",
  "degraded",
  "down",
  "unknown",
];

export function isRadiusServerStatus(value: string): value is RadiusServerStatus {
  return (RADIUS_SERVER_STATUSES as readonly string[]).includes(value);
}

export function isRadiusServerProtocol(value: string): value is RadiusServerProtocol {
  return (RADIUS_SERVER_PROTOCOLS as readonly string[]).includes(value);
}

export function isRadiusHealthStatus(value: string): value is RadiusHealthStatus {
  return (RADIUS_HEALTH_STATUSES as readonly string[]).includes(value);
}

/**
 * Basic hostname / IP validation. Accepts IPv4, IPv6, and RFC-1123 hostnames.
 * Rejects empty, whitespace-only, or suspicious characters.
 */
export function isValidRadiusHostname(hostname: string): boolean {
  if (hostname.length < 1 || hostname.length > 253) return false;
  if (/\s/.test(hostname)) return false;
  // Strip bracketed IPv6 presentation format before validation
  const isBracketedIPv6 =
    hostname.startsWith("[") && hostname.endsWith("]") && hostname.length > 2;
  const core = isBracketedIPv6 ? hostname.slice(1, -1) : hostname;
  if (!core || /[^a-zA-Z0-9.\-:\[\]]/.test(core)) return false;
  // IPv6 addresses can start/end with ':' — skip the start/end alphanumeric
  // check for bracketed IPv6; plain hostnames and IPs must still be clean.
  if (!isBracketedIPv6) {
    if (!/^[a-zA-Z0-9]/.test(core) || !/[a-zA-Z0-9]$/.test(core)) return false;
  }
  return true;
}

/**
 * Port must be in the valid range for RADIUS protocols: 1–65535.
 */
export function isValidRadiusPort(port: number): boolean {
  return Number.isFinite(port) && port >= 1 && port <= 65535 && Number.isInteger(port);
}

export type RadiusServerRow = {
  _id: string;
  name: string;
  hostname: string;
  port: number;
  protocol: RadiusServerProtocol;
  status: RadiusServerStatus;
  healthStatus: RadiusHealthStatus;
  region: string | null;
  certExpiryAt: number | null;
  lastHealthCheckAt: number | null;
  notes: string | null;
  registeredBy: string | null;
  createdAt: number | null;
};

export type RadiusServerMergeInput = {
  _id: string;
  name: string;
  hostname: string;
  port: number;
  protocol: RadiusServerProtocol;
  status: RadiusServerStatus;
  healthStatus: RadiusHealthStatus;
  region?: string | null;
  certExpiryAt?: number | null;
  lastHealthCheckAt?: number | null;
  notes?: string | null;
  registeredBy?: string | null;
  createdAt?: number | null;
};

/**
 * Merge enriched lookups into a radius server row into a flat, serializable
 * RadiusServerRow for the platform panel.
 */
export function buildRadiusServerRow(server: RadiusServerMergeInput): RadiusServerRow {
  return {
    _id: server._id,
    name: server.name,
    hostname: server.hostname,
    port: server.port,
    protocol: server.protocol,
    status: server.status,
    healthStatus: server.healthStatus,
    region: server.region ?? null,
    certExpiryAt: server.certExpiryAt ?? null,
    lastHealthCheckAt: server.lastHealthCheckAt ?? null,
    notes: server.notes ?? null,
    registeredBy: server.registeredBy ?? null,
    createdAt: server.createdAt ?? null,
  };
}
