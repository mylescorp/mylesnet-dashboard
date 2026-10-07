import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenantPermission, resolveTenantAccess, resolveUserByIdentity } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { tenantRoleHasPermission } from "./lib/permissions";

type SettingsSection = "branding" | "operations" | "billing" | "communications";

const defaultSettings = {
  branding: {
    networkName: "",
    supportEmail: "",
    supportPhone: "",
    brandColor: "#FA8200",
    termsAccepted: false,
  },
  operations: {
    pppoePruneDays: 90,
    hotspotPruneDays: 30,
    preExpiryDays: 3,
    fupWarningPercent: 80,
  },
  billing: {
    autoInvoice: true,
    invoicePrefix: "INV",
    walletEnabled: true,
  },
  communications: {
    paymentReceiptTemplate: "Hello @first_name, we received @amount_paid for @package_name.",
    expiryReminderTemplate: "Hello @first_name, your @package_name expires on @expiry_date.",
  },
} as const;

function text(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

type BrandingDefaults = { supportEmail: string; supportPhone: string; brandColor: string };

function normalize(settings: unknown, tenantName?: string, platformBranding?: BrandingDefaults) {
  const source = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const branding = source.branding && typeof source.branding === "object" ? source.branding as Record<string, unknown> : {};
  const operations = source.operations && typeof source.operations === "object" ? source.operations as Record<string, unknown> : {};
  const billing = source.billing && typeof source.billing === "object" ? source.billing as Record<string, unknown> : {};
  const communications = source.communications && typeof source.communications === "object" ? source.communications as Record<string, unknown> : {};
  const defaultBrandColor = platformBranding?.brandColor ?? defaultSettings.branding.brandColor;
  const color = text(branding.brandColor, 7, defaultBrandColor).toUpperCase();
  return {
    branding: {
      networkName: text(branding.networkName, 120, tenantName ?? defaultSettings.branding.networkName),
      supportEmail: text(branding.supportEmail, 160, platformBranding?.supportEmail ?? ""),
      supportPhone: text(branding.supportPhone, 20, platformBranding?.supportPhone ?? ""),
      brandColor: /^#[0-9A-F]{6}$/.test(color) ? color : defaultBrandColor,
      termsAccepted: branding.termsAccepted === true,
    },
    operations: {
      pppoePruneDays: wholeNumber(operations.pppoePruneDays, defaultSettings.operations.pppoePruneDays, 1, 3650),
      hotspotPruneDays: wholeNumber(operations.hotspotPruneDays, defaultSettings.operations.hotspotPruneDays, 1, 3650),
      preExpiryDays: wholeNumber(operations.preExpiryDays, defaultSettings.operations.preExpiryDays, 1, 60),
      fupWarningPercent: wholeNumber(operations.fupWarningPercent, defaultSettings.operations.fupWarningPercent, 1, 99),
    },
    billing: {
      autoInvoice: billing.autoInvoice !== false,
      invoicePrefix: text(billing.invoicePrefix, 12, defaultSettings.billing.invoicePrefix).replace(/[^A-Za-z0-9-]/g, "").toUpperCase() || defaultSettings.billing.invoicePrefix,
      walletEnabled: billing.walletEnabled !== false,
    },
    communications: {
      paymentReceiptTemplate: text(communications.paymentReceiptTemplate, 2000, defaultSettings.communications.paymentReceiptTemplate),
      expiryReminderTemplate: text(communications.expiryReminderTemplate, 2000, defaultSettings.communications.expiryReminderTemplate),
    },
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user || user.isActive === false || user.deactivatedAt !== undefined) {
      return { workspace: null, settings: normalize(undefined), canManage: false };
    }
    const access = await resolveTenantAccess(ctx, user);
    if (!access || !tenantRoleHasPermission(access.role, "dashboard:access")) {
      return { workspace: null, settings: normalize(undefined), canManage: false };
    }
    const { tenantId } = access;
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) return { workspace: null, settings: normalize(undefined), canManage: false };
    const platformBranding = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    return {
      workspace: { name: tenant.name, country: tenant.country, timezone: tenant.timezone, currency: tenant.currency },
      settings: normalize(tenant.settings, tenant.name, platformBranding ?? undefined),
      canManage: tenantRoleHasPermission(access.role, "settings:manage"),
    };
  },
});

export const update = mutation({
  args: {
    section: v.union(v.literal("branding"), v.literal("operations"), v.literal("billing"), v.literal("communications")),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const { tenantId, user } = await requireTenantPermission(ctx, "settings:manage");
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Workspace unavailable");
    const currentSettings = tenant.settings && typeof tenant.settings === "object" ? tenant.settings as Record<string, unknown> : {};
    const incoming = args.value && typeof args.value === "object" ? args.value as Record<string, unknown> : {};
    const platformBranding = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    const nextSection = normalize({ [args.section]: incoming }, tenant.name, platformBranding ?? undefined)[args.section];
    const nextSettings = { ...currentSettings, [args.section]: nextSection };
    await ctx.db.patch(tenantId, { settings: nextSettings, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "workspace.settings.update",
      entityTable: "tenants",
      entityId: tenantId,
      changedBy: user._id,
      after: { section: args.section },
    });
    return nextSection;
  },
});

export const reset = mutation({
  args: { section: v.union(v.literal("branding"), v.literal("operations"), v.literal("billing"), v.literal("communications")) },
  handler: async (ctx, args) => {
    const { tenantId, user } = await requireTenantPermission(ctx, "settings:manage");
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Workspace unavailable");
    const current = tenant.settings && typeof tenant.settings === "object" ? tenant.settings as Record<string, unknown> : {};
    const { [args.section]: _removed, ...remaining } = current;
    await ctx.db.patch(tenantId, { settings: remaining, updatedAt: Date.now() });
    const platformBranding = await ctx.db.query("platformWhiteLabelDefaults").withIndex("by_key", q => q.eq("key", "default")).first();
    await logAudit(ctx, {
      action: "workspace.settings.reset",
      entityTable: "tenants",
      entityId: tenantId,
      changedBy: user._id,
      after: { section: args.section },
    });
    return normalize(remaining, tenant.name, platformBranding ?? undefined)[args.section];
  },
});
