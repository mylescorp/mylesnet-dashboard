import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { permissionsOf as collectPermissions, requireAuthenticatedUser, requirePermission, resolveRoles, resolveUserByIdentity } from "./lib/auth";
import {
  decryptCentipidSecret,
  encryptCentipidSecret,
} from "./lib/centipidCredentials";
import {
  collectEntityRecords,
  extractEventType,
  mcpTextContents,
  parseAmountDisplay,
  parseCentipidTimestamp,
  parseMcpResponse,
  pickString,
} from "./lib/centipidVerify";

const maximumEventLimit = 100;
const centipidMcpEndpoint = "https://mcp.centipidbilling.com/mcp";
const dayMilliseconds = 24 * 60 * 60 * 1000;

function eventLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), maximumEventLimit);
}

function smoothOffset(offset: number | undefined): number {
  return Math.max(0, Math.floor(offset ?? 0));
}

function localDayStart(now: number, tzOffsetMinutes: number): number {
  const localNow = now + tzOffsetMinutes * 60_000;
  const dayStartLocal = Math.floor(localNow / dayMilliseconds) * dayMilliseconds;
  return dayStartLocal - tzOffsetMinutes * 60_000;
}

function webhookUrlFromSite(): string | null {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) return null;
  return `${siteUrl.replace(/\/$/, "")}/receiveCentipidWebhook`;
}

function canViewRevenue(permissions: string[]): boolean {
  return permissions.includes("revenue:view");
}

// ============================================================================
// Credentials & integration status
// ============================================================================

export const getCentipidCredentials = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("centipidCredentials").order("desc").first();
  },
});

export const getCallerRole = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) return null;
    const roles = await resolveRoles(ctx, user);
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0] ?? null;
    return {
      role: primary?.slug ?? null,
      isPlatform: roles.some((role) => role.isPlatform),
      permissions: collectPermissions(roles),
    };
  },
});

export const getCentipidSettingsView = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const [creds, latestDelivery] = await Promise.all([
      ctx.db.query("centipidCredentials").order("desc").first(),
      ctx.db.query("webhookDeliveryLog").withIndex("by_receivedAt").order("desc").first(),
    ]);
    return {
      hasCredentials: !!creds,
      ingestionPaused: creds?.ingestionPaused === true,
      webhookUrl: webhookUrlFromSite(),
      encryptionConfigured: !!process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY,
      latestDeliveryAt: latestDelivery?.receivedAt ?? null,
      lastHealthCheckAt: creds?.lastHealthCheckAt ?? null,
      lastHealthCheckOk: creds?.lastHealthCheckOk ?? null,
      lastHealthCheckError: creds?.lastHealthCheckError ?? null,
    };
  },
});

export const saveCentipidCredentials = mutation({
  args: {
    apiToken: v.optional(v.string()),
    webhookSigningSecret: v.optional(v.string()),
    ingestionPaused: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "centipid:manage");
    const token = args.apiToken?.trim() ?? "";
    const secret = args.webhookSigningSecret?.trim() ?? "";

    const existing = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!existing) {
      if (!token) throw new Error("The Centipid API token is required for initial setup.");
      if (!secret) throw new Error("The webhook signing secret is required for initial setup.");
      await ctx.db.insert("centipidCredentials", {
        apiToken: await encryptCentipidSecret(token),
        webhookSigningSecret: await encryptCentipidSecret(secret),
        ingestionPaused: args.ingestionPaused ?? false,
        createdAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.centipid.syncCentipidLiveData, {});
      return { saved: true };
    }

    if (!token && !secret) {
      throw new Error("Enter a new API token, a new webhook signing secret, or both to update credentials.");
    }

    const patch: { apiToken?: string; webhookSigningSecret?: string; ingestionPaused?: boolean } = {};
    if (token) patch.apiToken = await encryptCentipidSecret(token);
    if (secret) patch.webhookSigningSecret = await encryptCentipidSecret(secret);
    if (args.ingestionPaused !== undefined) patch.ingestionPaused = args.ingestionPaused;
    await ctx.db.patch(existing._id, patch);
    await ctx.scheduler.runAfter(0, internal.centipid.syncCentipidLiveData, {});
    return { saved: true };
  },
});

export const setCentipidIngestionPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "centipid:manage");
    const existing = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!existing) throw new Error("Configure credentials before pausing ingestion.");
    await ctx.db.patch(existing._id, { ingestionPaused: args.paused });
    if (!args.paused) {
      await ctx.scheduler.runAfter(0, internal.centipid.syncCentipidLiveData, {});
    }
    return { paused: args.paused };
  },
});

export const getCentipidIntegrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    return {
      available: !!creds,
      ingestionPaused: creds?.ingestionPaused === true,
    };
  },
});

/**
 * Read-only MCP output persisted by the collector. Because this is a Convex
 * query rather than the result of a browser action, clients receive updates
 * whenever the collector writes a newer snapshot.
 */
export const getCentipidLiveSnapshot = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "centipid:manage");
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!creds) {
      return { configured: false, at: null, lastAttemptAt: null, lastAttemptOk: null, lastAttemptError: null };
    }
    return {
      configured: true,
      at: creds.liveSnapshotAt ?? null,
      revenueToday: creds.liveSnapshotRevenueToday ?? null,
      revenueYesterday: creds.liveSnapshotRevenueYesterday ?? null,
      subscribersOnline: creds.liveSnapshotSubscribersOnline ?? null,
      activeSubscriptions: creds.liveSnapshotActiveSubscriptions ?? null,
      expiring24h: creds.liveSnapshotExpiring24h ?? null,
      unreconciledPayments: creds.liveSnapshotUnreconciledPayments ?? null,
      currency: creds.liveSnapshotCurrency ?? "UGX",
      lastAttemptAt: creds.liveSnapshotLastAttemptAt ?? null,
      lastAttemptOk: creds.liveSnapshotLastAttemptOk ?? null,
      lastAttemptError: creds.liveSnapshotLastAttemptError ?? null,
    };
  },
});

// ============================================================================
// Event feed queries
// ============================================================================

export const getRecentSubscriberEvents = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const offset = smoothOffset(args.offset);
    const limit = eventLimit(args.limit);
    return (await ctx.db
      .query("subscriberEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit + offset)).slice(offset, offset + limit);
  },
});

export const getRecentPaymentEvents = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const offset = smoothOffset(args.offset);
    const limit = eventLimit(args.limit);
    return (await ctx.db
      .query("paymentEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit + offset)).slice(offset, offset + limit);
  },
});

export const getRecentVoucherEvents = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const offset = smoothOffset(args.offset);
    const limit = eventLimit(args.limit);
    return (await ctx.db
      .query("voucherEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit + offset)).slice(offset, offset + limit);
  },
});

export const getRecentTicketEvents = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const offset = smoothOffset(args.offset);
    const limit = eventLimit(args.limit);
    return (await ctx.db
      .query("ticketEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit + offset)).slice(offset, offset + limit);
  },
});

export const getRecentAllEvents = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const offset = smoothOffset(args.offset);
    const limit = eventLimit(args.limit);
    const fetchLimit = limit + offset;
    const [subscribers, payments, vouchers, tickets] = await Promise.all([
      ctx.db.query("subscriberEvents").withIndex("by_timestamp").order("desc").take(fetchLimit),
      ctx.db.query("paymentEvents").withIndex("by_timestamp").order("desc").take(fetchLimit),
      ctx.db.query("voucherEvents").withIndex("by_timestamp").order("desc").take(fetchLimit),
      ctx.db.query("ticketEvents").withIndex("by_timestamp").order("desc").take(fetchLimit),
    ]);

    return [
      ...subscribers.map((event) => ({ ...event, category: "subscriber" as const })),
      ...payments.map((event) => ({ ...event, category: "payment" as const })),
      ...vouchers.map((event) => ({ ...event, category: "voucher" as const })),
      ...tickets.map((event) => ({ ...event, category: "ticket" as const })),
    ]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(offset, offset + limit);
  },
});

export const getWebhookDeliveryLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("webhookDeliveryLog")
      .withIndex("by_receivedAt")
      .order("desc")
      .take(eventLimit(args.limit));
  },
});

// ============================================================================
// Business summary (role-aware KPI card data)
// ============================================================================

export const getCentipidBusinessSummary = query({
  args: { tzOffsetMinutes: v.number() },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const tz = Math.min(Math.max(args.tzOffsetMinutes, -14 * 60), 14 * 60);
    const now = Date.now();
    const todayStart = localDayStart(now, tz);
    const weekStart = todayStart - 6 * dayMilliseconds;

    const window = (start: number, table: "subscriberEvents" | "paymentEvents" | "voucherEvents" | "ticketEvents") =>
      ctx.db.query(table).withIndex("by_timestamp", (q) => q.gte("timestamp", start)).collect();

    const [todaySubscribers, weekSubscribers, todayPayments, weekPayments, todayVouchers, weekVouchers, todayTickets, weekTickets] =
      await Promise.all([
        window(todayStart, "subscriberEvents"),
        window(weekStart, "subscriberEvents"),
        window(todayStart, "paymentEvents"),
        window(weekStart, "paymentEvents"),
        window(todayStart, "voucherEvents"),
        window(weekStart, "voucherEvents"),
        window(todayStart, "ticketEvents"),
        window(weekStart, "ticketEvents"),
      ]);

    const countOf = (rows: Array<{ eventType: string }>, eventType: string) =>
      rows.filter((row) => row.eventType === eventType).length;

    const received = todayPayments.filter((row) => row.eventType === "payment.received") as Array<{ amount: number }>;
    const refunds = todayPayments.filter((row) => row.eventType === "payment.refunded") as Array<{ amount: number }>;
    const receivedWeek = weekPayments.filter((row) => row.eventType === "payment.received") as Array<{ amount: number }>;
    const refundsWeek = weekPayments.filter((row) => row.eventType === "payment.refunded") as Array<{ amount: number }>;

    const sumAmount = (rows: Array<{ amount?: number }>) =>
      rows.reduce((total, row) => {
        const amount = row.amount;
        return total + (typeof amount === "number" && Number.isFinite(amount) ? amount : 0);
      }, 0);

    const todayGenerated = countOf(todayVouchers, "voucher.generated");
    const todayRedeemed = countOf(todayVouchers, "voucher.redeemed");

    const [pausedSubscribers, openTickets, creds] = await Promise.all([
      ctx.db.query("latestSubscriberState").withIndex("by_status", (q) => q.eq("status", "paused")).collect(),
      ctx.db.query("ticketStatus").withIndex("by_status", (q) => q.eq("status", "open")).collect(),
      ctx.db.query("centipidCredentials").order("desc").first(),
    ]);

    const user = await resolveUserByIdentity(ctx);
    const revenueVisible = user
      ? canViewRevenue(collectPermissions(await resolveRoles(ctx, user)))
      : false;

    const money = (receivedRows: Array<{ amount?: number }>, refundRows: Array<{ amount?: number }>) => ({
      collected: sumAmount(receivedRows),
      refunded: sumAmount(refundRows),
      net: sumAmount(receivedRows) - sumAmount(refundRows),
    });

    return {
      generatedAt: now,
      revenueVisible,
      today: {
        subscriberCreated: countOf(todaySubscribers, "subscriber.created"),
        subscriberPaused: countOf(todaySubscribers, "subscriber.paused"),
        subscriberResumed: countOf(todaySubscribers, "subscriber.resumed"),
        paymentCount: received.length,
        averagePayment: received.length > 0 ? sumAmount(received) / received.length : null,
        ...(revenueVisible ? money(received, refunds) : { collected: null, refunded: null, net: null }),
        vouchersGenerated: todayGenerated,
        vouchersRedeemed: todayRedeemed,
        redemptionRate: todayGenerated > 0 ? todayRedeemed / todayGenerated : null,
        ticketsOpened: countOf(todayTickets, "ticket.opened"),
        ticketsResolved: countOf(todayTickets, "ticket.resolved"),
      },
      last7d: {
        subscriberCreated: countOf(weekSubscribers, "subscriber.created"),
        paymentCount: receivedWeek.length,
        ...(revenueVisible ? money(receivedWeek, refundsWeek) : { collected: null, refunded: null, net: null }),
        vouchersGenerated: countOf(weekVouchers, "voucher.generated"),
        vouchersRedeemed: countOf(weekVouchers, "voucher.redeemed"),
        ticketsOpened: countOf(weekTickets, "ticket.opened"),
        ticketsResolved: countOf(weekTickets, "ticket.resolved"),
      },
      live: {
        pausedSubscribers: pausedSubscribers.length,
        openTickets: openTickets.length,
      },
      // A fresh MCP summary complements the event-backed activity stream.
      // Revenue remains permission-gated; the operational counts are safe for
      // every authenticated Centipid activity viewer.
      platformSnapshot: {
        at: creds?.liveSnapshotAt ?? null,
        subscribersOnline: creds?.liveSnapshotSubscribersOnline ?? null,
        activeSubscriptions: creds?.liveSnapshotActiveSubscriptions ?? null,
        expiring24h: creds?.liveSnapshotExpiring24h ?? null,
        unreconciledPayments: creds?.liveSnapshotUnreconciledPayments ?? null,
        revenueToday: revenueVisible ? creds?.liveSnapshotRevenueToday ?? null : null,
      },
    };
  },
});

// ============================================================================
// Webhook delivery logging & event ingestion (internal, called from http.ts)
// ============================================================================

export const logWebhookDelivery = internalMutation({
  args: {
    eventType: v.string(),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    errorMessage: v.optional(v.string()),
    signatureHeader: v.optional(v.string()),
    rawBodyPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveryLog", {
      receivedAt: Date.now(),
      eventType: args.eventType,
      signatureValid: args.signatureValid,
      processed: args.processed,
      errorMessage: args.errorMessage,
      signatureHeader: args.signatureHeader,
      rawBodyPreview: args.rawBodyPreview,
    });
  },
});

async function alreadyProcessed(
  ctx: MutationCtx,
  table: "subscriberEvents" | "paymentEvents" | "voucherEvents" | "ticketEvents",
  webhookEventId: string | undefined,
): Promise<boolean> {
  if (!webhookEventId) return false;
  const existing = await ctx.db
    .query(table)
    .withIndex("by_webhookEventId", (q) => q.eq("webhookEventId", webhookEventId))
    .first();
  return !!existing;
}

/** MCP list tools return persistent provider records, not webhook delivery ids.
 * Deduplicate those records by their Centipid id + event kind before inserting
 * them into the same activity stream as signed webhook deliveries. */
async function alreadyStoredSourceEvent(
  ctx: MutationCtx,
  table: "subscriberEvents" | "paymentEvents" | "voucherEvents" | "ticketEvents",
  sourceId: string,
  eventType: string,
): Promise<boolean> {
  if (!sourceId) return false;
  const rows = table === "subscriberEvents"
    ? await ctx.db.query("subscriberEvents").withIndex("by_subscriber", (q) => q.eq("centipidSubscriberId", sourceId)).collect()
    : table === "paymentEvents"
      ? await ctx.db.query("paymentEvents").withIndex("by_payment", (q) => q.eq("centipidPaymentId", sourceId)).collect()
      : table === "voucherEvents"
        ? await ctx.db.query("voucherEvents").withIndex("by_voucher", (q) => q.eq("centipidVoucherId", sourceId)).collect()
        : await ctx.db.query("ticketEvents").withIndex("by_ticket", (q) => q.eq("centipidTicketId", sourceId)).collect();
  return rows.some((row) => row.eventType === eventType);
}

/** First non-empty string value across the payload's envelope records. */
function pickNested(payload: unknown, keys: string[]): string {
  for (const record of collectEntityRecords(payload)) {
    const value = pickString(record, keys);
    if (value) return value;
  }
  return "";
}

/** Webhook timestamp to epoch ms; falls back to the delivery time. */
function resolveEventTimestamp(value: unknown): number {
  const resolved = parseCentipidTimestamp(value);
  return resolved ?? Date.now();
}

/** Amount from a numeric field or a formatted display string such as "UGX 1,000.00". */
function eventAmountField(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseAmountDisplay(value).amount;
}

export const handleSubscriberEvent = internalMutation({
  args: { payload: v.any(), webhookEventId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const eventType = extractEventType(args.payload) ?? "subscriber.unknown";
    if (await alreadyProcessed(ctx, "subscriberEvents", args.webhookEventId)) return { inserted: false };
    const subscriberId =
      pickNested(args.payload, ["subscriber_id", "subscriberId", "id", "account", "username"]) ||
      "";
    if (await alreadyStoredSourceEvent(ctx, "subscriberEvents", subscriberId, eventType)) return { inserted: false };

    const row = {
      centipidSubscriberId: subscriberId,
      eventType,
      phone: pickNested(args.payload, ["phone", "mobile", "msisdn"]),
      name: pickNested(args.payload, ["name", "customer_name", "full_name"]) || undefined,
      packageName: pickNested(args.payload, ["package_name", "packageName", "package"]),
      timestamp: resolveEventTimestamp(
        (args.payload as Record<string, unknown>).timestamp ??
        (args.payload as Record<string, unknown>).created_at ??
        (args.payload as Record<string, unknown>).occurred_at,
      ),
      rawPayloadRef: JSON.stringify(args.payload).slice(0, 500),
      webhookEventId: args.webhookEventId,
    };
    await ctx.db.insert("subscriberEvents", row);

    const state = await ctx.db
      .query("latestSubscriberState")
      .withIndex("by_subscriber", (q) => q.eq("centipidSubscriberId", subscriberId))
      .first();
    const status = eventType.includes("paused") ? "paused" : "active";
    if (state) {
      await ctx.db.patch(state._id, {
        status,
        phone: row.phone,
        name: row.name,
        packageName: row.packageName,
        lastEventType: eventType,
        lastSeen: row.timestamp,
      });
    } else {
      await ctx.db.insert("latestSubscriberState", {
        centipidSubscriberId: subscriberId,
        status,
        phone: row.phone,
        name: row.name,
        packageName: row.packageName,
        lastEventType: eventType,
        lastSeen: row.timestamp,
      });
    }
    return { inserted: true };
  },
});

export const handlePaymentEvent = internalMutation({
  args: { payload: v.any(), webhookEventId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const eventType = extractEventType(args.payload) ?? "payment.unknown";
    if (await alreadyProcessed(ctx, "paymentEvents", args.webhookEventId)) return { inserted: false };
    const paymentId =
      pickNested(args.payload, ["payment_id", "paymentId", "id", "reference", "receipt", "transaction_id"]) ||
      "";
    if (await alreadyStoredSourceEvent(ctx, "paymentEvents", paymentId, eventType)) return { inserted: false };
    const rawAmount =
      (args.payload as Record<string, unknown>).amount ??
      (args.payload as Record<string, unknown>).value ??
      (args.payload as Record<string, unknown>).total;
    const displayAmount = parseAmountDisplay(rawAmount);
    const explicitCurrency =
      pickNested(args.payload, ["currency", "ccy"]) ||
      (displayAmount.currency !== "UGX" ? displayAmount.currency : "");
    await ctx.db.insert("paymentEvents", {
      centipidPaymentId: paymentId,
      eventType,
      amount: eventAmountField(rawAmount),
      currency: explicitCurrency || displayAmount.currency || "UGX",
      method: pickNested(args.payload, ["method", "channel", "payment_method"]) || "unknown",
      subscriberPhone: pickNested(args.payload, ["subscriber_phone", "subscriberPhone", "phone", "mobile"]),
      timestamp: resolveEventTimestamp(
        (args.payload as Record<string, unknown>).timestamp ??
        (args.payload as Record<string, unknown>).at ??
        (args.payload as Record<string, unknown>).occurred_at ??
        (args.payload as Record<string, unknown>).paid_at,
      ),
      webhookEventId: args.webhookEventId,
    });
    return { inserted: true };
  },
});

export const handleVoucherEvent = internalMutation({
  args: { payload: v.any(), webhookEventId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const eventType = extractEventType(args.payload) ?? "voucher.unknown";
    if (await alreadyProcessed(ctx, "voucherEvents", args.webhookEventId)) return { inserted: false };
    const voucherId =
      pickNested(args.payload, ["voucher_id", "voucherId", "id", "code"]) ||
      "";
    if (await alreadyStoredSourceEvent(ctx, "voucherEvents", voucherId, eventType)) return { inserted: false };
    const phone =
      pickNested(args.payload, ["phone", "mobile", "customer_phone", "customerPhone"]) ||
      undefined;
    await ctx.db.insert("voucherEvents", {
      centipidVoucherId: voucherId,
      eventType,
      packageName: pickNested(args.payload, ["package_name", "packageName", "package"]),
      timestamp: resolveEventTimestamp(
        (args.payload as Record<string, unknown>).timestamp ??
        (args.payload as Record<string, unknown>).redeemed_at ??
        (args.payload as Record<string, unknown>).occurred_at,
      ),
      webhookEventId: args.webhookEventId,
      customerPhone: phone,
    });
    return { inserted: true };
  },
});

export const handleTicketEvent = internalMutation({
  args: { payload: v.any(), webhookEventId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const eventType = extractEventType(args.payload) ?? "ticket.unknown";
    if (await alreadyProcessed(ctx, "ticketEvents", args.webhookEventId)) return { inserted: false };
    const ticketId =
      pickNested(args.payload, ["ticket_id", "ticketId", "id"]) ||
      "";
    if (await alreadyStoredSourceEvent(ctx, "ticketEvents", ticketId, eventType)) return { inserted: false };
    const subject = pickNested(args.payload, ["subject", "title"]);
    const timestamp = resolveEventTimestamp(
      (args.payload as Record<string, unknown>).timestamp ??
      (args.payload as Record<string, unknown>).opened_at ??
      (args.payload as Record<string, unknown>).occurred_at,
    );

    await ctx.db.insert("ticketEvents", {
      centipidTicketId: ticketId,
      eventType,
      subject,
      timestamp,
      webhookEventId: args.webhookEventId,
    });

    const state = await ctx.db
      .query("ticketStatus")
      .withIndex("by_ticket", (q) => q.eq("centipidTicketId", ticketId))
      .first();
    const resolved = eventType.includes("resolved");
    if (state) {
      await ctx.db.patch(state._id, {
        status: resolved ? "resolved" : "open",
        subject: subject || state.subject,
        resolvedAt: resolved ? timestamp : state.resolvedAt,
        lastSeen: timestamp,
      });
    } else {
      await ctx.db.insert("ticketStatus", {
        centipidTicketId: ticketId,
        status: resolved ? "resolved" : "open",
        subject,
        openedAt: timestamp,
        resolvedAt: resolved ? timestamp : undefined,
        lastSeen: timestamp,
      });
    }
    return { inserted: true };
  },
});

// ============================================================================
// Admin actions: token verification, historical backfill, dev seed
// ============================================================================

async function requireAdminCaller(ctx: {
  runQuery: (fn: typeof internal.centipid.getCallerRole, args: Record<string, never>) => Promise<{
    role: string | null;
    isPlatform: boolean;
    permissions: string[];
  } | null>;
}): Promise<void> {
  const caller = await ctx.runQuery(internal.centipid.getCallerRole, {});
  if (!caller || !caller.permissions.includes("centipid:manage")) {
    throw new Error("Unauthorized: the centipid:manage permission is required");
  }
}

async function runMcpTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string[]> {
  const response = await fetch(centipidMcpEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  if (!response.ok) {
    throw new Error(`${name} returned HTTP ${response.status}`);
  }
  const parsed = parseMcpResponse(await response.text());
  const contents = mcpTextContents(parsed);
  if (contents.length === 0) {
    throw new Error(`${name} returned no text content`);
  }
  return contents;
}

function parseMcpToolItems(content: string): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }
  const normalizeItem = (item: Record<string, unknown>) => Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), value]),
  );
  const findArray = (value: unknown, depth = 0): Array<Record<string, unknown>> => {
    if (depth > 4) return [];
    if (Array.isArray(value) && value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      return value.map((item) => normalizeItem(item as Record<string, unknown>));
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    for (const key of ["subscribers", "payments", "batches", "tickets", "items", "results", "data", "rows"]) {
      const nested = findArray(record[key], depth + 1);
      if (nested.length > 0) return nested;
    }
    for (const nested of Object.values(record)) {
      const found = findArray(nested, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  };
  if (parsed) {
    const found = findArray(parsed);
    if (found.length > 0) return found;
  }

  // Some Centipid MCP tools return a Markdown table inside a text block.
  // Normalize its headings to the same snake_case shape as JSON responses.
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index];
    const divider = lines[index + 1];
    if (!header.includes("|") || !/^\|?\s*:?-{3,}/.test(divider)) continue;
    const columns = header.split("|").map((part) => part.trim()).filter(Boolean)
      .map((key) => key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    const rows: Array<Record<string, unknown>> = [];
    for (const row of lines.slice(index + 2)) {
      if (!row.includes("|")) break;
      const cells = row.split("|").map((part) => part.trim()).filter(Boolean);
      if (cells.length !== columns.length) continue;
      rows.push(Object.fromEntries(columns.map((column, cellIndex) => [column, cells[cellIndex]])));
    }
    if (rows.length > 0) return rows;
  }
  return [];
}

type RevenueSummarySnapshot = {
  revenueToday: number | null;
  revenueYesterday: number | null;
  subscribersOnline: number | null;
  activeSubscriptions: number | null;
  expiring24h: number | null;
  unreconciledPayments: number | null;
  currency: string;
};

function normalizeSummaryKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numericSummaryValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string") {
    const stripped = value.trim();
    if (!stripped) return Number.NaN;
    const amount = parseAmountDisplay(stripped);
    return Number.isFinite(amount.amount) ? amount.amount : Number.NaN;
  }
  return Number.NaN;
}

function summaryMatch(kind: keyof Omit<RevenueSummarySnapshot, "currency">, normalized: string): boolean {
  switch (kind) {
    case "revenueToday":
      return normalized === "revenue" || normalized.startsWith("revenuetoday") || normalized.startsWith("todayrevenue");
    case "revenueYesterday":
      return normalized.startsWith("revenueyesterday") || normalized.startsWith("yesterdayrevenue");
    case "subscribersOnline":
      return normalized.includes("subscribersonline") || normalized.includes("onlinesubscriber") || normalized.includes("subscriberonline") || normalized.includes("currentlyonline") || normalized.includes("onlineusers") || normalized.includes("activeusers") || normalized.includes("livsessions") || normalized.includes("livesessions");
    case "activeSubscriptions":
      return normalized.includes("activesubscription");
    case "expiring24h":
      return normalized.includes("expiring") || normalized.includes("expiry24") || normalized.includes("expires24") || normalized.includes("renewalsdue") || normalized.includes("duewithin24") || normalized.includes("expiringsoon");
    case "unreconciledPayments":
      return normalized.includes("unreconciled");
    default:
      return false;
  }
}

function parseRevenueSummary(content: string): RevenueSummarySnapshot {
  const candidates: Array<{ key: string; normalized: string; value: number; currency: string }> = [];

  const pushCandidate = (key: string, value: unknown) => {
    const number = numericSummaryValue(value);
    if (!Number.isFinite(number)) return;
    let currency = "UGX";
    if (typeof value === "string") {
      const parsed = parseAmountDisplay(value);
      if (parsed.currency && !/^UGX$/i.test(parsed.currency)) currency = parsed.currency;
    }
    candidates.push({ key: String(key), normalized: normalizeSummaryKey(String(key)), value: number, currency });
  };

  const walk = (node: unknown, parent = "") => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const joined = parent ? `${parent} ${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, joined);
        continue;
      }
      if (Array.isArray(value)) continue;
      pushCandidate(joined, value);
    }
  };

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === "object") walk(parsed);

  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([^:：]+?)[:：]\s*(.+)$/);
    if (match) pushCandidate(match[1], match[2]);
  }

  // Also recognize Markdown summary rows such as `| Currently online | 15 |`.
  for (const line of content.split(/\r?\n/)) {
    const cells = line.trim().split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length >= 2 && !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      pushCandidate(cells[0], cells[1]);
    }
  }

  const kinds: Array<keyof Omit<RevenueSummarySnapshot, "currency">> = [
    "revenueToday",
    "revenueYesterday",
    "subscribersOnline",
    "activeSubscriptions",
    "expiring24h",
    "unreconciledPayments",
  ];
  const snapshot: RevenueSummarySnapshot = {
    revenueToday: null,
    revenueYesterday: null,
    subscribersOnline: null,
    activeSubscriptions: null,
    expiring24h: null,
    unreconciledPayments: null,
    currency: "UGX",
  };
  const claimed = new Set<number>();
  for (const kind of kinds) {
    for (let index = 0; index < candidates.length; index += 1) {
      if (claimed.has(index)) continue;
      const entry = candidates[index];
      if (!summaryMatch(kind, entry.normalized)) continue;
      snapshot[kind] = entry.value;
      if (entry.currency && !/^UGX$/i.test(entry.currency)) snapshot.currency = entry.currency;
      claimed.add(index);
      break;
    }
  }
  return snapshot;
}

export const verifyCentipidToken = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; toolCount?: number; probe?: string; error?: string }> => {
    await requireAdminCaller(ctx);
    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    if (!creds) return { ok: false, error: "No Centipid credentials are configured." };
    const token = await decryptCentipidSecret(creds.apiToken);

    const response = await fetch(centipidMcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    if (!response.ok) {
      return { ok: false, error: `The MCP endpoint rejected the key: HTTP ${response.status}. Verify the token is complete and unrevoked.` };
    }

    const list = parseMcpResponse(await response.text()) as { result?: { tools?: unknown[] } };
    const toolCount = list?.result?.tools?.length ?? 0;
    let probe: string | null = null;
    try {
      const contents = await runMcpTool(token, "revenue_summary", {});
      const first = contents[0];
      probe = typeof first === "string" ? first.slice(0, 300) : null;
    } catch {
      probe = null;
    }
    return { ok: toolCount > 0, toolCount, probe: probe ?? undefined };
  },
});

/** Fetches and persists the MCP overview; scheduled and browser-triggered callers share this path. */
export const refreshCentipidLiveSnapshot = internalAction({
  args: {},
  handler: async (ctx): Promise<
    | ({ ok: true; at: number } & RevenueSummarySnapshot)
    | { ok: false; error: string }
  > => {
    const at = Date.now();
    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    if (!creds) return { ok: false, error: "No Centipid credentials are configured." };
    const token = await decryptCentipidSecret(creds.apiToken);
    try {
      const contents = await runMcpTool(token, "revenue_summary", {});
      const snapshot = parseRevenueSummary(contents.join("\n"));
      await ctx.runMutation(internal.centipid.recordCentipidLiveSnapshot, { at, ok: true, ...snapshot });
      return { ok: true, at, ...snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.centipid.recordCentipidLiveSnapshot, {
        at,
        ok: false,
        error: message.slice(0, 240),
      });
      return { ok: false, error: message };
    }
  },
});

/** Allows the page to request its first snapshot immediately; it then subscribes to updates. */
export const syncCentipidLiveSnapshot = action({
  args: {},
  handler: async (ctx): Promise<
    | ({ ok: true; at: number } & RevenueSummarySnapshot)
    | { ok: false; error: string }
  > => {
    await requireAdminCaller(ctx);
    const { overview } = await ctx.runAction(internal.centipid.syncCentipidLiveData, {});
    return overview;
  },
});

export const getCentipidLiveOverview = action({
  args: {},
  handler: async (ctx): Promise<
    | ({ ok: true; at: number } & RevenueSummarySnapshot)
    | { ok: false; error: string }
  > => {
    await requireAdminCaller(ctx);
    return ctx.runAction(internal.centipid.refreshCentipidLiveSnapshot, {});
  },
});

export const runCentipidHealthCheck = internalAction({
  args: {},
  handler: async (ctx) => {
    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    if (!creds) return { checked: false };

    const token = await decryptCentipidSecret(creds.apiToken);
    let ok = false;
    let toolCount = 0;
    let error: string | undefined;
    try {
      const response = await fetch(centipidMcpEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      if (!response.ok) {
        error = `The MCP endpoint rejected the key: HTTP ${response.status}`;
      } else {
        const list = parseMcpResponse(await response.text()) as { result?: { tools?: unknown[] } };
        toolCount = list?.result?.tools?.length ?? 0;
        ok = toolCount > 0;
        if (!ok) error = "The MCP endpoint returned no tools for this token.";
      }
    } catch (errorValue) {
      error = errorValue instanceof Error ? errorValue.message : "Unknown error";
    }

    await ctx.runMutation(internal.centipid.recordCentipidHealthCheck, {
      at: Date.now(),
      ok,
      error: ok ? undefined : error,
    });
    return { checked: true, ok, toolCount, error: ok ? undefined : error };
  },
});

export const recordCentipidHealthCheck = internalMutation({
  args: { at: v.number(), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!creds) return;
    await ctx.db.patch(creds._id, {
      lastHealthCheckAt: args.at,
      lastHealthCheckOk: args.ok,
      lastHealthCheckError: args.error,
    });
  },
});

export const recordCentipidLiveSnapshot = internalMutation({
  args: {
    at: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    revenueToday: v.optional(v.union(v.number(), v.null())),
    revenueYesterday: v.optional(v.union(v.number(), v.null())),
    subscribersOnline: v.optional(v.union(v.number(), v.null())),
    activeSubscriptions: v.optional(v.union(v.number(), v.null())),
    expiring24h: v.optional(v.union(v.number(), v.null())),
    unreconciledPayments: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!creds) return;
    const attempt = {
      liveSnapshotLastAttemptAt: args.at,
      liveSnapshotLastAttemptOk: args.ok,
      liveSnapshotLastAttemptError: args.ok ? undefined : args.error ?? "Unknown error",
    };
    if (!args.ok) {
      await ctx.db.patch(creds._id, attempt);
      return;
    }
    await ctx.db.patch(creds._id, {
      ...attempt,
      liveSnapshotAt: args.at,
      liveSnapshotRevenueToday: args.revenueToday ?? null,
      liveSnapshotRevenueYesterday: args.revenueYesterday ?? null,
      liveSnapshotSubscribersOnline: args.subscribersOnline ?? null,
      liveSnapshotActiveSubscriptions: args.activeSubscriptions ?? null,
      liveSnapshotExpiring24h: args.expiring24h ?? null,
      liveSnapshotUnreconciledPayments: args.unreconciledPayments ?? null,
      liveSnapshotCurrency: args.currency ?? "UGX",
    });
  },
});

/** Supplements only MCP fields that the list tools explicitly expose. */
export const enrichCentipidLiveSnapshot = internalMutation({
  args: {
    at: v.number(),
    subscribersOnline: v.optional(v.number()),
    expiring24h: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!creds) return;
    const patch: {
      liveSnapshotAt: number;
      liveSnapshotSubscribersOnline?: number;
      liveSnapshotExpiring24h?: number;
    } = { liveSnapshotAt: args.at };
    if (args.subscribersOnline !== undefined) patch.liveSnapshotSubscribersOnline = args.subscribersOnline;
    if (args.expiring24h !== undefined) patch.liveSnapshotExpiring24h = args.expiring24h;
    await ctx.db.patch(creds._id, patch);
  },
});

/**
 * One scheduled read-only collector cycle. The overview supplies current
 * platform KPIs while the list tools reconcile event-backed cards and their
 * live Convex projections. Signed webhooks still arrive immediately.
 */
export const syncCentipidLiveData = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    overview: ({ ok: true; at: number } & RevenueSummarySnapshot) | { ok: false; error: string };
    report: { tool: string; inserted: number; error?: string }[];
  }> => {
    const overview = await ctx.runAction(internal.centipid.refreshCentipidLiveSnapshot, {});
    if (!overview.ok) return { overview, report: [] };
    const { report } = await ctx.runAction(internal.centipid.runCentipidSnapshot, {});
    return { overview, report };
  },
});

export const runCentipidSnapshot = internalAction({
  args: {},
  handler: async (ctx) => {
    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    if (!creds) throw new Error("No Centipid credentials are configured.");
    const token = await decryptCentipidSecret(creds.apiToken);
    const derivedSnapshot: { subscribersOnline?: number; expiring24h?: number } = {};

    const booleanValue = (value: unknown): boolean | null => {
      if (value === true || value === 1) return true;
      if (value === false || value === 0) return false;
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "online", "connected", "active"].includes(normalized)) return true;
      if (["false", "no", "offline", "disconnected", "inactive"].includes(normalized)) return false;
      return null;
    };

    const expiryTimestamp = (value: unknown): number | undefined => {
      const absolute = parseCentipidTimestamp(value);
      if (absolute !== undefined) return absolute;
      const relative = String(value ?? "").toLowerCase().match(/(?:in\s*)?(\d+)\s*(m|h|d|minutes?|hours?|days?)/);
      if (!relative) return undefined;
      const quantity = Number(relative[1]);
      const unit = relative[2].charAt(0);
      return Date.now() + quantity * (unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : 60_000);
    };

    type CentipidEntry =
      | { kind: "subscriber"; eventType?: string; payload: { subscriber_id: string; phone: string; name?: unknown; package_name: string; timestamp: number } }
      | { kind: "payment"; eventType?: string; payload: { payment_id: string; amount: number; currency: string; method: string; subscriber_phone: string; timestamp: number } }
      | { kind: "voucher"; eventType?: string; payload: { voucher_id: string; package_name: string; timestamp: number } }
      | { kind: "ticket"; eventType?: string; payload: { ticket_id: string; subject: string; timestamp: number } };

    const tools: Array<[string, (item: Record<string, unknown>) => CentipidEntry]> = [
      ["list_subscribers", (item) => {
        const status = String(item.status ?? item.state ?? item.subscription_status ?? "").toLowerCase();
        const paused = booleanValue(item.paused ?? item.is_paused) === true || status.includes("paused") || status.includes("suspend");
        return {
          kind: "subscriber" as const,
          eventType: paused ? "subscriber.paused" : "subscriber.created",
          payload: {
            subscriber_id: String(item.id ?? item.subscriber_id ?? item.account ?? ""),
            phone: String(item.phone ?? item.mobile ?? ""),
            name: item.name ?? item.customer_name,
            package_name: String(item.package_name ?? item.package ?? item.type ?? ""),
            timestamp: parseCentipidTimestamp(item.created_at) ?? Date.now(),
          },
        };
      }],
      ["payments_report", (item) => {
        const { amount, currency } = parseAmountDisplay(item.amount);
        return {
          kind: "payment" as const,
          payload: {
            payment_id: String(item.receipt ?? item.id ?? item.payment_id ?? item.reference ?? ""),
            amount,
            currency: String(item.currency ?? currency),
            method: String(item.method ?? item.channel ?? "unknown"),
            subscriber_phone: String(item.phone ?? item.subscriber_phone ?? ""),
            timestamp: parseCentipidTimestamp(item.at ?? item.created_at ?? item.timestamp) ?? Date.now(),
          },
        };
      }],
      ["voucher_stock", (item) => {
        const status = String(item.status ?? item.state ?? "").toLowerCase();
        const redeemed = item.redeemed === true || !!item.redeemed_at || status.includes("redeem");
        return {
          kind: "voucher" as const,
          eventType: redeemed ? "voucher.redeemed" : "voucher.generated",
          payload: {
            voucher_id: String(item.id ?? item.batch_id ?? item.code ?? ""),
            package_name: String(item.package_name ?? item.package ?? ""),
            timestamp: parseCentipidTimestamp(item.redeemed_at ?? item.created_at ?? item.updated_at) ?? Date.now(),
          },
        };
      }],
      ["open_tickets", (item) => ({
        kind: "ticket" as const,
        payload: {
          ticket_id: String(item.id ?? item.ticket_id ?? ""),
          subject: String(item.subject ?? item.title ?? item.summary ?? ""),
          timestamp: parseCentipidTimestamp(item.created_at ?? item.opened_at ?? item.timestamp) ?? Date.now(),
        },
      })],
    ];

    const report: { tool: string; inserted: number; error?: string }[] = [];
    for (const [toolName, normalize] of tools) {
      try {
        const contents = await runMcpTool(token, toolName, {});
        let inserted = 0;
        for (const content of contents) {
          const items = parseMcpToolItems(content);
          if (toolName === "list_subscribers" && items.length > 0) {
            const onlineSignals = items.map((item) => booleanValue(item.online ?? item.is_online ?? item.session_online ?? item.connection_status));
            if (onlineSignals.some((value) => value !== null)) {
              derivedSnapshot.subscribersOnline = onlineSignals.filter((value) => value === true).length;
            }
            const now = Date.now();
            const expiries = items
              .map((item) => expiryTimestamp(item.expires_at ?? item.expiry_at ?? item.expiration_at ?? item.expiry ?? item.expires_on))
              .filter((value): value is number => value !== undefined);
            if (expiries.length > 0) {
              derivedSnapshot.expiring24h = expiries.filter((value) => value >= now && value <= now + 86_400_000).length;
            }
          }
          for (const item of items) {
            const entry = normalize(item);
            const eventType =
              entry.eventType ??
              (entry.kind === "subscriber"
                ? "subscriber.created"
                : entry.kind === "payment"
                  ? "payment.received"
                  : entry.kind === "voucher"
                    ? "voucher.generated"
                    : "ticket.opened");
            let result: { inserted: boolean } = { inserted: false };
            const payload = { event_type: eventType, ...entry.payload };
            if (entry.kind === "subscriber") {
              result = await ctx.runMutation(internal.centipid.handleSubscriberEvent, {
                payload,
                webhookEventId: undefined,
              });
            } else if (entry.kind === "payment") {
              result = await ctx.runMutation(internal.centipid.handlePaymentEvent, {
                payload,
                webhookEventId: undefined,
              });
            } else if (entry.kind === "voucher") {
              result = await ctx.runMutation(internal.centipid.handleVoucherEvent, {
                payload,
                webhookEventId: undefined,
              });
            } else {
              result = await ctx.runMutation(internal.centipid.handleTicketEvent, {
                payload,
                webhookEventId: undefined,
              });
            }
            if (result.inserted) inserted += 1;
          }
        }
        report.push({ tool: toolName, inserted });
      } catch (error) {
        report.push({
          tool: toolName,
          inserted: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    if (derivedSnapshot.subscribersOnline !== undefined || derivedSnapshot.expiring24h !== undefined) {
      await ctx.runMutation(internal.centipid.enrichCentipidLiveSnapshot, { at: Date.now(), ...derivedSnapshot });
    }
    return { report };
  },
});

export const fetchHistoricalCentipidData = action({
  args: {},
  handler: async (ctx): Promise<{ report: { tool: string; inserted: number; error?: string }[] }> => {
    await requireAdminCaller(ctx);
    return ctx.runAction(internal.centipid.runCentipidSnapshot, {});
  },
});

export const seedCentipidEventsForTesting = mutation({
  args: { count: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "centipid:manage");
    const count = Math.min(Math.max(args.count ?? 12, 1), 50);
    const now = Date.now();
    const phones = ["256701111111", "256702222222", "256703333333", "256704444444", "256705555555", "256706666666"];
    const packages = ["Daily 1GB", "Daily 3GB", "Weekly 10GB", "Monthly 30GB", "Monthly 100GB"];
    let inserted = 0;
    for (let index = 0; index < count; index += 1) {
      const isVoucher = index % 3 === 0;
      const isTicket = index % 4 === 0;
      const hoursAgo = (index % 48) * 0.5;
      const timestamp = now - hoursAgo * 60 * 60 * 1000;
      if (isVoucher) {
        const redeemed = index % 2 === 0;
        await ctx.db.insert("voucherEvents", {
          centipidVoucherId: `seed-v-${index}`,
          eventType: redeemed ? "voucher.redeemed" : "voucher.generated",
          packageName: packages[index % packages.length],
          timestamp,
          customerPhone: redeemed ? phones[index % phones.length] : undefined,
        });
      } else if (isTicket) {
        await ctx.db.insert("ticketEvents", {
          centipidTicketId: `seed-t-${index}`,
          eventType: index % 2 === 0 ? "ticket.opened" : "ticket.resolved",
          subject: ["No internet", "Slow speed", "Billing question", "Router offline"][index % 4],
          timestamp,
        });
      } else {
        const isPayment = index % 2 === 1;
        if (isPayment) {
          await ctx.db.insert("paymentEvents", {
            centipidPaymentId: `seed-p-${index}`,
            eventType: "payment.received",
            amount: 5000 + (index % 10) * 1000,
            currency: "UGX",
            method: "MTN",
            subscriberPhone: phones[index % phones.length],
            timestamp,
          });
        } else {
          const paused = index % 3 === 0;
          await ctx.db.insert("subscriberEvents", {
            centipidSubscriberId: `seed-s-${index}`,
            eventType: paused ? "subscriber.paused" : "subscriber.created",
            phone: phones[index % phones.length],
            name: `Seed Subscriber ${index + 1}`,
            packageName: packages[index % packages.length],
            timestamp,
            rawPayloadRef: "seeded for testing",
          });
        }
      }
      inserted += 1;
    }
    return { inserted };
  },
});

// ============================================================================
// Retention & pruning
// ============================================================================

const logRetentionMs = 30 * dayMilliseconds;
const eventRetentionMs = 24 * 30 * dayMilliseconds;

export const pruneCentipidData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const logCutoff = now - logRetentionMs;
    const eventCutoff = now - eventRetentionMs;
    let prunedLogs = 0;
    let wipedPayloads = 0;
    let prunedEvents = 0;
    let prunedProjections = 0;

    const logs = await ctx.db
      .query("webhookDeliveryLog")
      .withIndex("by_receivedAt", (q) => q.lte("receivedAt", logCutoff))
      .take(500);
    await Promise.all(logs.map((log) => ctx.db.delete(log._id)));
    prunedLogs += logs.length;

    const payloadRows = await ctx.db
      .query("subscriberEvents")
      .withIndex("by_timestamp", (q) => q.lte("timestamp", logCutoff))
      .take(500);
    for (const row of payloadRows) {
      await ctx.db.patch(row._id, { rawPayloadRef: undefined });
      wipedPayloads += 1;
    }

    const eventTables = ["subscriberEvents", "paymentEvents", "voucherEvents", "ticketEvents"] as const;
    for (const table of eventTables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_timestamp", (q) => q.lte("timestamp", eventCutoff))
        .take(500);
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
      prunedEvents += rows.length;
    }

    const subscriberProjections = await ctx.db
      .query("latestSubscriberState")
      .withIndex("by_status")
      .filter((q) => q.lte(q.field("lastSeen"), eventCutoff))
      .take(500);
    await Promise.all(subscriberProjections.map((row) => ctx.db.delete(row._id)));
    prunedProjections += subscriberProjections.length;

    const ticketProjections = await ctx.db
      .query("ticketStatus")
      .withIndex("by_status")
      .filter((q) => q.lte(q.field("lastSeen"), eventCutoff))
      .take(500);
    await Promise.all(ticketProjections.map((row) => ctx.db.delete(row._id)));
    prunedProjections += ticketProjections.length;

    return { prunedLogs, wipedPayloads, prunedEvents, prunedProjections };
  },
});
