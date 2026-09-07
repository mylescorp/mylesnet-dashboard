import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePermission, requirePlatformOwner } from "./lib/auth";
import { encryptRouterCredential, isEncryptedRouterCredential } from "./lib/routerCredentials";
import { logAudit } from "./lib/auditLog";

function cleanText(value: string, label: string, maxLength = 160): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(`Invalid ${label}`);
  return cleaned;
}

function validatedHttpsUrl(value: string): string {
  const candidate = cleanText(value, "router URL", 500);
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("Router URL must be a valid HTTPS URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Router URL must be an HTTPS origin without credentials or a path");
  return url.origin;
}

function validatedThresholds(warning: number | undefined, critical: number | undefined) {
  const safeWarning = warning ?? 75;
  const safeCritical = critical ?? 90;
  if (!Number.isFinite(safeWarning) || !Number.isFinite(safeCritical) || safeWarning < 1 || safeCritical > 100 || safeWarning >= safeCritical) throw new Error("CPU warning must be lower than critical, within 1-100");
  return { warning: safeWarning, critical: safeCritical };
}

// List routers WITHOUT credentials (safe for client queries)
export const listRouters = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "routers:read");
    const routers = (await ctx.db.query("routers").order("desc").collect()).filter((router) => router.archivedAt === undefined);
    
    // Check which routers have credentials set (without exposing them)
    const routersWithCredentials = await Promise.all(
      routers.map(async (router) => {
        const creds = await ctx.db
          .query("routerCredentials")
          .withIndex("by_router", (q) => q.eq("routerId", router._id))
          .first();
        return {
          ...router,
          hasCredentials: !!creds,
        };
      })
    );

    return routersWithCredentials;
  },
});

/** Safe onboarding state for the UI. It deliberately omits credentials and raw RouterOS responses. */
export const getOnboardingStatuses = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "routers:read");
    const routers = (await ctx.db.query("routers").collect()).filter((router) => router.archivedAt === undefined);
    return Promise.all(routers.map(async (router) => {
      const [credentials, collectorRun, health] = await Promise.all([
        ctx.db.query("routerCredentials").withIndex("by_router", (q) => q.eq("routerId", router._id)).first(),
        ctx.db.query("collectorRuns").withIndex("by_router_observedAt", (q) => q.eq("routerId", router._id)).order("desc").first(),
        ctx.db.query("healthSamples").withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id)).order("desc").first(),
      ]);
      const now = Date.now();
      const live = !!health && now - health.timestamp < 120_000;
      const status = !credentials
        ? "credentials_required"
        : collectorRun?.status === "failed"
          ? "collector_failed"
          : live
            ? "live"
            : "collector_pending";
      return {
        routerId: router._id,
        status,
        collectorObservedAt: collectorRun?.observedAt ?? null,
        collectorMessage: collectorRun?.message ?? null,
        lastTelemetryAt: health?.timestamp ?? null,
      };
    }));
  },
});

// Get router credentials - SERVER-SIDE ONLY, never exposed to client
// This should only be called from other Convex actions, not from the frontend
export const getRouterCredentials = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (!creds) {
      throw new Error("Router credentials not found");
    }

    return {
      username: creds.encryptedUsername,
      password: creds.encryptedPassword,
    };
  },
});

export const getRouterWithCredentials = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) return null;

    const credentials = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();
    if (!credentials) return null;

    return {
      router: { restBaseUrl: router.restBaseUrl },
      username: credentials.encryptedUsername,
      password: credentials.encryptedPassword,
    };
  },
});

export const getCollectorConnection = internalQuery({
  args: { routerId: v.string() },
  handler: async (ctx, args) => {
    const routerId = await ctx.db.normalizeId("routers", args.routerId);
    if (!routerId) return null;

    const router = await ctx.db.get(routerId);
    if (!router || router.archivedAt !== undefined) return null;

    const credentials = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .first();
    if (!credentials) return null;

    return {
      restBaseUrl: router.restBaseUrl,
      username: credentials.encryptedUsername,
      password: credentials.encryptedPassword,
      configVersion: `${router.updatedAt}:${credentials.updatedAt}`,
    };
  },
});

export const getLatestConfigurationBaseline = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) =>
    ctx.db
      .query("configWatchBaselines")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first(),
});

export const getLatestRouterConfigurationSnapshot = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) =>
    ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first(),
});

export const saveConfigurationBaseline = internalMutation({
  args: { routerId: v.id("routers"), snapshotJson: v.string() },
  handler: async (ctx, args) =>
    ctx.db.insert("configWatchBaselines", {
      routerId: args.routerId,
      snapshotJson: args.snapshotJson,
      capturedAt: Date.now(),
    }),
});

// Add a new router with credentials (server-side only)
export const addRouter = mutation({
  args: {
    name: v.string(),
    restBaseUrl: v.string(),
    location: v.string(),
    marketId: v.optional(v.id("markets")),
    username: v.string(),
    password: v.string(),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const name = cleanText(args.name, "router name");
    const location = cleanText(args.location, "location");
    const username = cleanText(args.username, "RouterOS username", 128);
    if (!args.password || args.password.length > 512) throw new Error("Invalid RouterOS password");
    const thresholds = validatedThresholds(args.cpuWarningThreshold, args.cpuCriticalThreshold);
    const restBaseUrl = validatedHttpsUrl(args.restBaseUrl);
    const routerId = await ctx.db.insert("routers", {
      name,
      restBaseUrl,
      location,
      marketId: args.marketId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cpuWarningThreshold: thresholds.warning,
      cpuCriticalThreshold: thresholds.critical,
    });

    // Store credentials separately - NEVER exposed to client
    await ctx.db.insert("routerCredentials", {
      routerId,
      encryptedUsername: await encryptRouterCredential(username),
      encryptedPassword: await encryptRouterCredential(args.password),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, { action: "router.create", entityTable: "routers", entityId: routerId, changedBy: user._id, after: { name, location, restBaseUrl, marketId: args.marketId, hasCredentials: true } });
    return routerId;
  },
});

// Update router details (not credentials)
export const updateRouter = mutation({
  args: {
    routerId: v.id("routers"),
    name: v.optional(v.string()),
    restBaseUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    marketId: v.optional(v.id("markets")),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const { routerId, ...updates } = args;
    const router = await ctx.db.get(routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const thresholds = validatedThresholds(updates.cpuWarningThreshold ?? router.cpuWarningThreshold, updates.cpuCriticalThreshold ?? router.cpuCriticalThreshold);
    const patch = { name: updates.name === undefined ? undefined : cleanText(updates.name, "router name"), restBaseUrl: updates.restBaseUrl === undefined ? undefined : validatedHttpsUrl(updates.restBaseUrl), location: updates.location === undefined ? undefined : cleanText(updates.location, "location"), marketId: updates.marketId, cpuWarningThreshold: thresholds.warning, cpuCriticalThreshold: thresholds.critical, updatedAt: Date.now() };
    await ctx.db.patch(routerId, patch);
    await logAudit(ctx, { action: "router.update", entityTable: "routers", entityId: routerId, changedBy: user._id, before: { name: router.name, location: router.location, restBaseUrl: router.restBaseUrl, marketId: router.marketId }, after: { name: patch.name ?? router.name, location: patch.location ?? router.location, restBaseUrl: patch.restBaseUrl ?? router.restBaseUrl, marketId: patch.marketId } });
  },
});

// Update router credentials (server-side only)
export const updateRouterCredentials = mutation({
  args: {
    routerId: v.id("routers"),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const username = cleanText(args.username, "RouterOS username", 128);
    if (!args.password || args.password.length > 512) throw new Error("Invalid RouterOS password");
    const existing = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedUsername: await encryptRouterCredential(username),
        encryptedPassword: await encryptRouterCredential(args.password),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("routerCredentials", {
        routerId: args.routerId,
        encryptedUsername: await encryptRouterCredential(username),
        encryptedPassword: await encryptRouterCredential(args.password),
        updatedAt: Date.now(),
      });
    }
    await logAudit(ctx, { action: "router.credentials.rotate", entityTable: "routers", entityId: args.routerId, changedBy: user._id, after: { hasCredentials: true } });
  },
});

/** Converts legacy plaintext router credentials without changing router records. */
export const migrateLegacyRouterCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const credentials = await ctx.db.query("routerCredentials").collect();
    let migrated = 0;
    for (const credential of credentials) {
      if (isEncryptedRouterCredential(credential.encryptedUsername) && isEncryptedRouterCredential(credential.encryptedPassword)) continue;
      await ctx.db.patch(credential._id, {
        encryptedUsername: isEncryptedRouterCredential(credential.encryptedUsername)
          ? credential.encryptedUsername
          : await encryptRouterCredential(credential.encryptedUsername),
        encryptedPassword: isEncryptedRouterCredential(credential.encryptedPassword)
          ? credential.encryptedPassword
          : await encryptRouterCredential(credential.encryptedPassword),
        updatedAt: Date.now(),
      });
      migrated += 1;
    }
    return { migrated };
  },
});

/** Owner-only migration status. It never returns credential values. */
export const getRouterCredentialProtectionStatus = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const credentials = await ctx.db.query("routerCredentials").collect();
    return {
      total: credentials.length,
      legacy: credentials.filter((credential) =>
        !isEncryptedRouterCredential(credential.encryptedUsername) ||
        !isEncryptedRouterCredential(credential.encryptedPassword),
      ).length,
    };
  },
});

/** Archive a router and its AP inventory. Historical monitoring remains intact. */
export const archiveRouter = mutation({
  args: { routerId: v.id("routers"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const reason = cleanText(args.reason, "archive reason", 300);
    const now = Date.now();
    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    const switches = await ctx.db
      .query("networkSwitches")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    await ctx.db.patch(args.routerId, { archivedAt: now, archivedBy: user._id, archiveReason: reason, updatedAt: now });
    await Promise.all(accessPoints.filter((ap) => ap.archivedAt === undefined).map((ap) => ctx.db.patch(ap._id, { archivedAt: now, archivedBy: user._id, archiveReason: `Router archived: ${reason}`, updatedAt: now })));
    await Promise.all(switches.filter((entry) => entry.archivedAt === undefined).map((entry) => ctx.db.patch(entry._id, { archivedAt: now, archivedBy: user._id, archiveReason: `Router archived: ${reason}`, updatedAt: now })));
    await logAudit(ctx, { action: "router.archive", entityTable: "routers", entityId: args.routerId, changedBy: user._id, before: { name: router.name }, after: { reason, archivedAccessPoints: accessPoints.length, archivedSwitches: switches.length } });
  },
});

/** Permanently delete a router and every dependent record: RouterOS credentials, access points and their samples, telemetry, config-watch history, DHCP/queue observations, sessions, incidents and shift notes. Admin or owner only. Cannot be undone. */
export const deleteRouter = mutation({
  args: { routerId: v.id("routers"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const router = await ctx.db.get(args.routerId);
    if (!router) throw new Error("Router not found");
    const reason = cleanText(args.reason, "delete reason", 300);

    const purge = async (rows: { _id: string }[]) => {
      await Promise.all(rows.map((row) => ctx.db.delete(row._id as never)));
      return rows.length;
    };

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    const accessPointIds = accessPoints.map((ap) => ap._id);
    const counts: Record<string, number> = { accessPoints: accessPoints.length };

    const resources: Array<[string, { _id: string }[]]> = [
      ["routerCredentials", await ctx.db.query("routerCredentials").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["networkSwitches", await ctx.db.query("networkSwitches").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["collectorRuns", await ctx.db.query("collectorRuns").withIndex("by_router_observedAt", (q) => q.eq("routerId", args.routerId)).collect()],
      ["healthSamples", await ctx.db.query("healthSamples").withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId)).collect()],
      ["activeHotspotSessions", await ctx.db.query("activeHotspotSessions").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["usageSamples", await ctx.db.query("usageSamples").withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId)).collect()],
      ["incidents", await ctx.db.query("incidents").withIndex("by_router_open", (q) => q.eq("routerId", args.routerId)).collect()],
      ["shiftNotes", await ctx.db.query("shiftNotes").withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId)).collect()],
      ["configWatchBaselines", await ctx.db.query("configWatchBaselines").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["routerConfigurationSnapshots", await ctx.db.query("routerConfigurationSnapshots").withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId)).collect()],
      ["dhcpLeases", await ctx.db.query("dhcpLeases").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["simpleQueues", await ctx.db.query("simpleQueues").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["routerTelemetry", await ctx.db.query("routerTelemetry").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
      ["systemEvents", await ctx.db.query("systemEvents").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).collect()],
    ];
    for (const [key, rows] of resources) {
      counts[key] = await purge(rows);
    }

    for (const accessPointId of accessPointIds) {
      counts.accessPointSamples = (counts.accessPointSamples ?? 0) + await purge(
        await ctx.db.query("accessPointSamples").withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", accessPointId)).collect()
      );
    }

    await ctx.db.delete(args.routerId);
    await logAudit(ctx, { action: "router.delete", entityTable: "routers", entityId: args.routerId, changedBy: user._id, before: { name: router.name, location: router.location, restBaseUrl: router.restBaseUrl }, after: { reason, removed: counts } });
    return { removed: counts };
  },
});
