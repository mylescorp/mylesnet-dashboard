export type MembershipAccessStatus = "active" | "pending" | "revoked";
export type MembershipAccessOverride = "active" | "revoked" | undefined;

export function resolveMembershipSync(
  override: MembershipAccessOverride,
  providerStatus: MembershipAccessStatus,
  overrideUpdatedAt?: number,
  providerUpdatedAt?: number,
) {
  if (override === undefined) return { status: providerStatus, clearOverride: false };
  if (override === providerStatus && overrideUpdatedAt !== undefined && providerUpdatedAt !== undefined && providerUpdatedAt >= overrideUpdatedAt) {
    return { status: override, clearOverride: true };
  }
  return { status: override, clearOverride: false };
}
