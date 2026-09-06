import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireNetworkOperator } from "./lib/auth";

// Get open incidents (unresolved)
export const getOpenIncidents = query({
  handler: async (ctx) => {
    await requireNetworkOperator(ctx);
    const all = await ctx.db.query("incidents").collect();
    return all.filter((i) => !i.resolvedAt);
  },
});

// List all incidents
export const listIncidents = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    const all = await ctx.db.query("incidents").order("desc").collect();

    if (args.routerId) {
      return all.filter((i) => i.routerId === args.routerId);
    }

    return all;
  },
});

// Acknowledge an incident
export const acknowledgeIncident = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = (await requireNetworkOperator(ctx))._id;
    await ctx.db.patch(args.incidentId, {
      acknowledgedBy: userId,
    });
  },
});

// Resolve an incident
export const resolveIncident = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
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
    await requireNetworkOperator(ctx);
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

// Internal mutation to check switch health and create/resolve incidents
export const checkSwitchHealth = internalMutation({
  args: {
    routerId: v.id("routers"),
    switchId: v.id("networkSwitches"),
  },
  handler: async (ctx, args) => {
    const switchData = await ctx.db.get(args.switchId);
    if (!switchData || switchData.archivedAt !== undefined) return;

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();

    const linkedAPs = accessPoints.filter(
      (ap) => ap.archivedAt === undefined && ap.switchId === args.switchId
    );

    if (linkedAPs.length === 0) return; // No APs connected, nothing to monitor

    // Check health of linked APs
    const now = Date.now();
    let onlineCount = 0;

    for (const ap of linkedAPs) {
      const latestSample = await ctx.db
        .query("accessPointSamples")
        .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", ap._id))
        .order("desc")
        .first();

      if (latestSample?.linkState) {
        onlineCount++;
      }
    }

    const totalAPs = linkedAPs.length;
    const severity = onlineCount === 0
      ? "critical"
      : onlineCount < totalAPs
        ? "warning"
        : null;

    // Check for existing switch incidents
    const existingIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_router_open", (q) => q.eq("routerId", args.routerId))
      .collect();

    const switchIncidents = existingIncidents.filter(
      (i) =>
        i.resolvedAt === undefined &&
        i.note.includes(`Switch ${switchData.name}`)
    );

    if (severity) {
      // Create incident if none exists with matching severity
      const matchingIncident = switchIncidents.find((i) => i.severity === severity);
      if (!matchingIncident) {
        const note = onlineCount === 0
          ? `Switch ${switchData.name}: All ${totalAPs} access points offline`
          : `Switch ${switchData.name}: ${onlineCount}/${totalAPs} access points online`;

        await ctx.db.insert("incidents", {
          routerId: args.routerId,
          openedAt: now,
          note,
          severity,
        });
      }
    } else {
      // Resolve all switch incidents when all APs are online
      await Promise.all(
        switchIncidents.map((incident) =>
          ctx.db.patch(incident._id, { resolvedAt: now })
        )
      );
    }
  },
});
