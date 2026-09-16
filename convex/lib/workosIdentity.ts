/**
 * WorkOS AuthKit is configured as a Convex custom-JWT provider. Convex exposes
 * non-OIDC claims by their JWT key, so the active organization is `org_id`,
 * rather than an `organizationId` property.
 */
export function organizationIdFromWorkosIdentity(identity: Record<string, unknown>): string | undefined {
  const organizationId = identity["org_id"];
  return typeof organizationId === "string" && /^org_[A-Za-z0-9]+$/.test(organizationId)
    ? organizationId
    : undefined;
}
