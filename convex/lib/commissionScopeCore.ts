/** Resolve safe tenant ownership for an accrued commission. */
export function commissionTenantId(input: {
  agentTenantId?: string | null;
  marketTenantId?: string | null;
  activeAssignmentMatches: boolean;
  authenticatedTenantId?: string | null;
}): string {
  const { agentTenantId, marketTenantId, activeAssignmentMatches, authenticatedTenantId } = input;
  if (!agentTenantId || !marketTenantId) throw new Error("Commission ownership is unavailable.");
  if (agentTenantId !== marketTenantId) throw new Error("Agent and market must belong to the same workspace.");
  if (authenticatedTenantId && authenticatedTenantId !== marketTenantId) {
    throw new Error("The market is outside the active workspace.");
  }
  if (!activeAssignmentMatches) throw new Error("The agent is not actively assigned to this market.");
  return marketTenantId;
}
