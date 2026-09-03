import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listBroadcasts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return (await ctx.db.query("broadcasts").collect()).sort(
      (a, b) => b.sentAt - a.sentAt
    );
  },
});

export const getBroadcastDeliveryLogs = query({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("broadcastDeliveryLogs")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .collect();
  },
});

/**
 * Send an SMS broadcast via Africa's Talking. Resolves recipient list
 * based on targetScope, then writes delivery logs per agent.
 *
 * NOTE: The actual Africa's Talking API call happens in an HTTP action
 * because Convex mutations cannot make external HTTP requests. This
 * mutation prepares the broadcast and delivery logs; the send is
 * triggered via a Convex action or API route.
 */
export const createBroadcast = mutation({
  args: {
    message: v.string(),
    targetScope: v.union(
      v.literal("all_agents"),
      v.literal("market_agents"),
      v.literal("specific_agents")
    ),
    targetMarketId: v.optional(v.id("markets")),
    targetAgentIds: v.optional(v.array(v.id("agents"))),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();

    if (args.targetScope === "market_agents" && !args.targetMarketId) {
      throw new Error("targetMarketId is required for market_agents scope");
    }
    if (args.targetScope === "specific_agents" && !args.targetAgentIds?.length) {
      throw new Error("targetAgentIds is required for specific_agents scope");
    }

    let agents;
    if (args.targetScope === "all_agents") {
      agents = await ctx.db
        .query("agents")
        .filter((q) =>
          q.and(
            q.eq(q.field("lifecycleStatus"), "active"),
            q.neq(q.field("status"), "deleted")
          )
        )
        .collect();
    } else if (args.targetScope === "market_agents") {
      const assignments = await ctx.db
        .query("agentMarketAssignments")
        .withIndex("by_market", (q) => q.eq("marketId", args.targetMarketId!))
        .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
        .collect();

      const agentIds = [...new Set(assignments.map((a) => a.agentId))];
      agents = [];
      for (const id of agentIds) {
        const agent = await ctx.db.get(id);
        if (agent && agent.lifecycleStatus === "active" && agent.status !== "deleted") {
          agents.push(agent);
        }
      }
    } else {
      agents = [];
      for (const id of args.targetAgentIds!) {
        const agent = await ctx.db.get(id);
        if (agent) agents.push(agent);
      }
    }

    if (agents.length === 0) {
      throw new Error("No recipients matched the target scope");
    }

    const broadcastId = await ctx.db.insert("broadcasts", {
      message: args.message,
      channel: "sms",
      targetScope: args.targetScope,
      targetMarketId: args.targetMarketId,
      targetAgentIds: args.targetAgentIds,
      sentBy: user._id,
      sentAt: now,
      recipientCount: agents.length,
      deliveryStatus: "queued",
    });

    for (const agent of agents) {
      await ctx.db.insert("broadcastDeliveryLogs", {
        broadcastId,
        agentId: agent._id,
        phone: agent.phone,
        status: "queued",
        sentAt: now,
      });
    }

    await logAudit(ctx, {
      action: "broadcast.create",
      entityTable: "broadcasts",
      entityId: broadcastId,
      changedBy: user._id,
      after: {
        recipientCount: agents.length,
        targetScope: args.targetScope,
        messagePreview: args.message.slice(0, 100),
      },
    });

    return { broadcastId, recipientCount: agents.length };
  },
});

export const markBroadcastDeliveryStatus = mutation({
  args: {
    deliveryLogId: v.id("broadcastDeliveryLogs"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryLogId, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

export const markBroadcastComplete = mutation({
  args: {
    broadcastId: v.id("broadcasts"),
    deliveryStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.broadcastId, {
      deliveryStatus: args.deliveryStatus,
    });
  },
});
