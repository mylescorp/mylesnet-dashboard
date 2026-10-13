import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { anyApi } from "convex/server";
import { deactivateOrganizationMembership, reactivateOrganizationMembership } from "./workos";

const membershipStatus = v.union(v.literal("active"), v.literal("revoked"));

export const retryPendingMembershipSyncs = internalAction({
  args: {},
  returns: v.object({ attempted: v.number() }),
  handler: async (ctx) => {
    const pending = await ctx.runQuery(anyApi.platformUserDirectory.listPendingMembershipSyncs, {}) as Array<{ requestId: string; userId: string; tenantId: string; status: "active" | "revoked" }>;
    for (const request of pending) {
      try {
        const desired = await ctx.runQuery(anyApi.platformUserDirectory.getDesiredMembershipAccess, { userId: request.userId, tenantId: request.tenantId }) as { organizationId: string; workosUserId: string; status: "active" | "revoked" };
        let providerAlreadyMatched = false;
        let providerUpdatedAt: number | null = null;
        if (desired.status === "revoked") ({ alreadyMatched: providerAlreadyMatched, providerUpdatedAt } = await deactivateOrganizationMembership(desired.organizationId, desired.workosUserId));
        else ({ alreadyMatched: providerAlreadyMatched, providerUpdatedAt } = await reactivateOrganizationMembership(desired.organizationId, desired.workosUserId));
        const latest = await ctx.runQuery(anyApi.platformUserDirectory.getDesiredMembershipAccess, { userId: request.userId, tenantId: request.tenantId }) as { status: "active" | "revoked" };
        await ctx.runMutation(anyApi.platformUserDirectory.recordMembershipSync, { requestId: request.requestId, appliedStatus: desired.status, succeeded: latest.status === desired.status, providerAlreadyMatched: latest.status === desired.status ? providerAlreadyMatched : false, providerUpdatedAt: providerUpdatedAt ?? undefined });
      } catch {
        await ctx.runMutation(anyApi.platformUserDirectory.recordMembershipSync, { requestId: request.requestId, appliedStatus: request.status, succeeded: false });
      }
    }
    return { attempted: pending.length };
  },
});
