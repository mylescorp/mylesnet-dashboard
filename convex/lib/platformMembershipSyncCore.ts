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

export function shouldApplyMembershipProviderEvent(
  currentMembershipId: string | undefined,
  incomingMembershipId: string,
  currentUpdatedAt: number | undefined,
  incomingUpdatedAt: number | undefined,
  deletionRecorded: boolean,
) {
  if (deletionRecorded && currentMembershipId === incomingMembershipId && incomingUpdatedAt === undefined) return false;
  if (currentMembershipId === undefined || currentMembershipId === incomingMembershipId) {
    if (currentUpdatedAt !== undefined && incomingUpdatedAt !== undefined) return incomingUpdatedAt >= currentUpdatedAt;
    return true;
  }
  if (incomingUpdatedAt !== undefined && currentUpdatedAt !== undefined) return incomingUpdatedAt >= currentUpdatedAt;
  return deletionRecorded;
}
