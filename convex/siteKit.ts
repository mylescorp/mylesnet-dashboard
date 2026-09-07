import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Site kit (spec §10 + "Device Information") — two halves:
 *
 * 1. Per-market API keys. The site (MikroTik script / gateway) calls the
 *    public telemetry endpoint with `X-Site-Key`. The raw key is shown once at
 *    generation; only its SHA-256 hash is persisted on the market row. Rotation
 *    invalidates the old hash the moment the new key is created.
 * 2. Approved hardware/firmware catalogue (`standardSiteKit`), used by the
 *    device-registration flow and the site-kit admin page.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSiteKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "sk_";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

export const generateSiteKeyForMarket = mutation({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    const rawKey = generateSiteKey();
    const apiKeyHash = await sha256Hex(rawKey);
    await ctx.db.patch(args.marketId, {
      apiKeyHash,
      apiKeyCreatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "siteKey.generate",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
      after: { keyRotated: true, createdAt: Date.now() },
    });

    // Returned exactly once — do not log or persist this value.
    return { apiKey: rawKey };
  },
});

export const clearSiteKeyForMarket = mutation({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    await ctx.db.patch(args.marketId, {
      apiKeyHash: undefined,
      apiKeyCreatedAt: undefined,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "siteKey.revoke",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
    });
  },
});

/** Public-route validation: compare a presented key against a market's hash. */
export const verifyMarketSiteKey = internalQuery({
  args: { marketId: v.id("markets"), keyToHash: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db.get(args.marketId);
    if (!market?.apiKeyHash || !market.apiKeyCreatedAt) return { valid: false, reason: "no_key" };
    const hash = await sha256Hex(args.keyToHash);
    const valid = hash === market.apiKeyHash;
    return valid ? { valid: true } : { valid: false, reason: "mismatch" };
  },
});

// ---------------------------------------------------------------------------
// Standard site kit catalogue
// ---------------------------------------------------------------------------

export const listSiteKitConfigs = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "site_kit:read");
    return (await ctx.db.query("standardSiteKit").collect()).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  },
});

export const saveSiteKitConfig = mutation({
  args: {
    deviceType: v.union(v.literal("mikrotik"), v.literal("outdoor_ap"), v.literal("indoor_ap"), v.literal("extender")),
    approvedModel: v.string(),
    approvedFirmwareVersion: v.optional(v.string()),
    requiresUps: v.boolean(),
    snmpProfile: v.optional(v.string()),
    effectiveFrom: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "site_kit:manage");
    const now = Date.now();
    const existing = await ctx.db
      .query("standardSiteKit")
      .withIndex("by_device_type", (q) => q.eq("deviceType", args.deviceType).eq("status", "active"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "superseded" });
    }
    const id = await ctx.db.insert("standardSiteKit", {
      deviceType: args.deviceType,
      approvedModel: args.approvedModel,
      approvedFirmwareVersion: args.approvedFirmwareVersion,
      requiresUps: args.requiresUps,
      snmpProfile: args.snmpProfile,
      effectiveFrom: args.effectiveFrom,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "siteKit.save",
      entityTable: "standardSiteKit",
      entityId: id,
      changedBy: user._id,
      after: args,
    });
    return id;
  },
});

export const updateSiteKitConfig = mutation({
  args: {
    configId: v.id("standardSiteKit"),
    approvedModel: v.optional(v.string()),
    approvedFirmwareVersion: v.optional(v.string()),
    requiresUps: v.optional(v.boolean()),
    snmpProfile: v.optional(v.string()),
    effectiveFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "site_kit:manage");
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Site kit configuration not found");
    const patch = {
      approvedModel: args.approvedModel,
      approvedFirmwareVersion: args.approvedFirmwareVersion,
      requiresUps: args.requiresUps,
      snmpProfile: args.snmpProfile,
      effectiveFrom: args.effectiveFrom,
    };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await ctx.db.patch(args.configId, { ...cleaned, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "siteKit.update",
      entityTable: "standardSiteKit",
      entityId: args.configId,
      changedBy: user._id,
      after: cleaned,
    });
  },
});

export const archiveSiteKitConfig = mutation({
  args: { configId: v.id("standardSiteKit") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "site_kit:manage");
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Site kit configuration not found");
    await ctx.db.patch(args.configId, { status: "superseded", updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "siteKit.archive",
      entityTable: "standardSiteKit",
      entityId: args.configId,
      changedBy: user._id,
    });
  },
});
