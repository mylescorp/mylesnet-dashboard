import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformAdmin } from "./lib/auth";

/**
 * Single trash screen across every soft-deletable entity, per Section 4.9.
 * Restore mutations themselves live on each entity's own module
 * (markets.restoreMarket, agents.restoreAgent, devices.restoreDevice, etc.)
 * since restore semantics differ per entity — this query is read-only
 * aggregation for the /platform/trash listing.
 */
export const listDeletedEntities = query({
  args: {
    entityType: v.optional(
      v.union(
        v.literal("market"),
        v.literal("device"),
        v.literal("agent"),
        v.literal("prospect"),
        v.literal("ticket")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);

    const results: Array<{
      entityType: "market" | "device" | "agent" | "prospect" | "ticket";
      id: string;
      name: string;
      deletedAt?: number;
      deletedBy?: string;
      deleteReason?: string;
    }> = [];

    if (!args.entityType || args.entityType === "market") {
      const markets = await ctx.db
        .query("markets")
        .withIndex("by_status", (q) => q.eq("status", "deleted"))
        .collect();
      results.push(
        ...markets.map((m) => ({
          entityType: "market" as const,
          id: m._id,
          name: m.name,
          deletedAt: m.deletedAt,
          deletedBy: m.deletedBy,
          deleteReason: m.deleteReason,
        }))
      );
    }

    if (!args.entityType || args.entityType === "device") {
      const devices = await ctx.db
        .query("devices")
        .withIndex("by_lifecycleStatus", (q) => q.eq("lifecycleStatus", "deleted"))
        .collect();
      results.push(
        ...devices.map((d) => ({
          entityType: "device" as const,
          id: d._id,
          name: d.name,
          deletedAt: d.deletedAt,
          deletedBy: d.deletedBy,
          deleteReason: d.deleteReason,
        }))
      );
    }

    if (!args.entityType || args.entityType === "agent") {
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_lifecycleStatus", (q) => q.eq("lifecycleStatus", "terminated"))
        .collect();
      results.push(
        ...agents.map((a) => ({
          entityType: "agent" as const,
          id: a._id,
          name: a.name,
          deletedAt: a.deletedAt,
          deletedBy: a.deletedBy,
          deleteReason: a.deleteReason,
        }))
      );
    }

    if (!args.entityType || args.entityType === "prospect") {
      const prospects = await ctx.db
        .query("marketProspects")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect();
      results.push(
        ...prospects.map((p) => ({
          entityType: "prospect" as const,
          id: p._id,
          name: p.name,
          deletedAt: p.deletedAt,
          deletedBy: p.deletedBy,
          deleteReason: p.deleteReason,
        }))
      );
    }

    if (!args.entityType || args.entityType === "ticket") {
      const tickets = await ctx.db
        .query("supportTickets")
        .filter((q) => q.neq(q.field("deletedAt"), undefined))
        .collect();
      results.push(
        ...tickets.map((t) => ({
          entityType: "ticket" as const,
          id: t._id,
          name: t.subject,
          deletedAt: t.deletedAt,
          deletedBy: t.deletedBy,
          deleteReason: t.deleteReason,
        }))
      );
    }

    return results.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  },
});
