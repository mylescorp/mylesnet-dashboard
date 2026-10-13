import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const DEFAULTS = { supportEmail: "", supportPhone: "", brandColor: "#FA8200" } as const;

function validate(input: { supportEmail: string; supportPhone: string; brandColor: string }) {
  const supportEmail = input.supportEmail.trim().toLowerCase();
  const supportPhone = input.supportPhone.trim();
  const brandColor = input.brandColor.trim().toUpperCase();
  if (supportEmail.length > 160 || (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))) {
    throw new Error("Enter a valid support email address (maximum 160 characters)");
  }
  if (supportPhone.length > 20 || (supportPhone && !/^\+?[0-9().\-\s]+$/.test(supportPhone))) {
    throw new Error("Support phone may contain only digits, spaces, +, parentheses, dots, and hyphens (maximum 20 characters)");
  }
  if (!/^#[0-9A-F]{6}$/.test(brandColor)) throw new Error("Brand color must be a six-digit hex value such as #FA8200");
  return { supportEmail, supportPhone, brandColor };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    return row
      ? { ...DEFAULTS, supportEmail: row.supportEmail, supportPhone: row.supportPhone, brandColor: row.brandColor, configured: true, updatedAt: row.updatedAt }
      : { ...DEFAULTS, configured: false, updatedAt: null };
  },
});

export const save = mutation({
  args: { supportEmail: v.string(), supportPhone: v.string(), brandColor: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const next = validate(args);
    const existing = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...next, updatedBy: actor._id, updatedAt: now });
      await logAudit(ctx, { action: "platform.whiteLabelDefaults.updated", entityTable: "platformWhiteLabelDefaults", entityId: existing._id, changedBy: actor._id, before: { supportEmail: existing.supportEmail, supportPhone: existing.supportPhone, brandColor: existing.brandColor }, after: next });
    } else {
      const id = await ctx.db.insert("platformWhiteLabelDefaults", { key: "default", ...next, updatedBy: actor._id, updatedAt: now });
      await logAudit(ctx, { action: "platform.whiteLabelDefaults.created", entityTable: "platformWhiteLabelDefaults", entityId: id, changedBy: actor._id, after: next });
    }
    return { ...next, configured: true, updatedAt: now };
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const existing = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    if (!existing) return { ...DEFAULTS, configured: false };
    await ctx.db.delete(existing._id);
    await logAudit(ctx, { action: "platform.whiteLabelDefaults.reset", entityTable: "platformWhiteLabelDefaults", entityId: existing._id, changedBy: actor._id, before: { supportEmail: existing.supportEmail, supportPhone: existing.supportPhone, brandColor: existing.brandColor }, after: DEFAULTS });
    return { ...DEFAULTS, configured: false };
  },
});
