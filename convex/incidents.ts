import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all incidents
export const listIncidents = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("incidents").order("desc").collect();
    
    if (args.routerId) {
      return all.filter((i) => i.routerId === args.routerId);
    }
    
    return all;
  },
});

// Get open incidents (unresolved)
export const getOpenIncidents = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("incidents").collect();
    return all.filter((i) => !i.resolvedAt);
  },
});

// Acknowledge an incident
export const acknowledgeIncident = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, {
      acknowledgedBy: undefined, // Simplified for now
    });
  },
});

// Resolve an incident
export const resolveIncident = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, {
      resolvedAt: Date.now(),
    });
  },
});

// Create a manual incident
export const createIncident = mutation({
  args: {
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    note: v.string(),
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("incidents", {
      routerId: args.routerId,
      accessPointId: args.accessPointId,
      openedAt: Date.now(),
      resolvedAt: undefined,
      acknowledgedBy: undefined,
      note: args.note,
      severity: args.severity,
    });
  },
});
