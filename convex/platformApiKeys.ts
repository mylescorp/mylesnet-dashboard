import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { isPlatformApiKeyActive } from "./lib/platformApiKeysCore";

const apiScope = v.union(
  v.literal("organizations:read"),
);

function publicKey(key: { _id: string; name: string; prefix: string; scopes: string[]; createdAt: number; expiresAt?: number; revokedAt?: number }) {
  return { _id: key._id, name: key.name, prefix: key.prefix, scopes: key.scopes, createdAt: key.createdAt, expiresAt: key.expiresAt ?? null, revokedAt: key.revokedAt ?? null };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function validatePlatformKeyInput(nameInput: string, scopesInput: string[], expiresAt: number | undefined, now: number) {
  const name = nameInput.trim();
  if (!name || name.length > 80) throw new Error("Key name must be between 1 and 80 characters");
  const scopes = [...new Set(scopesInput)];
  if (!scopes.length || scopes.length > 4 || scopes.some(scope => !["organizations:read", "infrastructure:read", "billing:read", "support:read"].includes(scope))) throw new Error("Choose between 1 and 4 supported API scopes");
  if (expiresAt !== undefined && (expiresAt <= now || expiresAt > now + 365 * 24 * 60 * 60 * 1000)) throw new Error("Expiry must be within the next 365 days");
  return { name, scopes };
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `mn_platform_${encoded}`;
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const result = await ctx.db.query("platformApiKeys").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts, numItems: Math.min(50, Math.max(1, Math.floor(args.paginationOpts.numItems))),
    });
    return { ...result, page: result.page.map(publicKey) };
  },
});

/** Token-authenticated, bounded public API projection used by the v1 route. */
export const listOrganizationsByApiKey = query({
  args: { tokenHash: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const key = await ctx.db.query("platformApiKeys").withIndex("by_tokenHash", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!key || !isPlatformApiKeyActive(key, Date.now()) || !key.scopes.includes("organizations:read")) return null;
    const result = await ctx.db.query("tenants").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts, numItems: Math.min(50, Math.max(1, Math.floor(args.paginationOpts.numItems))),
    });
    return {
      ...result,
      page: result.page.filter(tenant => tenant.deletedAt === undefined).map(tenant => ({
        id: tenant._id, name: tenant.name, slug: tenant.slug, country: tenant.country,
        currency: tenant.currency, status: tenant.status, createdAt: tenant.createdAt,
      })),
    };
  },
});

export const create = mutation({
  args: { name: v.string(), scopes: v.array(apiScope), expiresAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const now = Date.now();
    const { name, scopes } = validatePlatformKeyInput(args.name, args.scopes, args.expiresAt, now);
    const token = newToken();
    const prefix = token.slice(0, 18);
    const keyId = await ctx.db.insert("platformApiKeys", { name, prefix, tokenHash: await sha256Hex(token), scopes, createdBy: user._id, createdAt: now, expiresAt: args.expiresAt });
    await logAudit(ctx, { action: "platform.apiKey.created", entityTable: "platformApiKeys", entityId: keyId, changedBy: user._id, after: { name, prefix, scopes, expiresAt: args.expiresAt ?? null } });
    return { id: keyId, token };
  },
});

export const revoke = mutation({
  args: { keyId: v.id("platformApiKeys") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.revokedAt !== undefined) throw new Error("Active API key not found");
    const revokedAt = Date.now();
    await ctx.db.patch(key._id, { revokedAt, revokedBy: user._id });
    await logAudit(ctx, { action: "platform.apiKey.revoked", entityTable: "platformApiKeys", entityId: key._id, changedBy: user._id, before: { prefix: key.prefix, scopes: key.scopes }, after: { revokedAt } });
    return { revoked: true };
  },
});

export const update = mutation({
  args: { keyId: v.id("platformApiKeys"), name: v.optional(v.string()), scopes: v.optional(v.array(apiScope)), expiresAt: v.optional(v.union(v.number(), v.null())) },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.revokedAt !== undefined) throw new Error("Active API key not found");
    const name = args.name?.trim();
    if (args.name !== undefined && (!name || name.length > 80)) throw new Error("Key name must be between 1 and 80 characters");
    const scopes = args.scopes === undefined ? key.scopes : [...new Set(args.scopes)];
    if (!scopes.length || scopes.length > 4) throw new Error("Choose between 1 and 4 API scopes");
    const now = Date.now();
    if (typeof args.expiresAt === "number" && (args.expiresAt <= now || args.expiresAt > now + 365 * 24 * 60 * 60 * 1000)) throw new Error("Expiry must be within the next 365 days");
    const patch: Partial<Doc<"platformApiKeys">> = {};
    if (name !== undefined) patch.name = name;
    if (args.scopes !== undefined) patch.scopes = scopes;
    if (args.expiresAt !== undefined) {
      patch.expiresAt = args.expiresAt ?? undefined;
    }
    if (Object.keys(patch).length === 0) throw new Error("Make at least one change before saving");
    await ctx.db.patch(key._id, patch);
    await logAudit(ctx, { action: "platform.apiKey.updated", entityTable: "platformApiKeys", entityId: key._id, changedBy: user._id, before: { name: key.name, scopes: key.scopes, expiresAt: key.expiresAt ?? null }, after: { name: name ?? key.name, scopes, expiresAt: args.expiresAt === undefined ? key.expiresAt ?? null : args.expiresAt } });
    return { updated: true };
  },
});
