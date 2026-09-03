import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

const maximumEventLimit = 100;

function eventLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), maximumEventLimit);
}

export const getCentipidCredentials = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("centipidCredentials").order("desc").first();
  },
});

export const getCentipidIntegrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    return { available: !!creds };
  },
});

export const getRecentSubscriberEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("subscriberEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(eventLimit(args.limit));
  },
});

export const getRecentPaymentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("paymentEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(eventLimit(args.limit));
  },
});

export const getRecentVoucherEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("voucherEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(eventLimit(args.limit));
  },
});

export const getRecentTicketEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("ticketEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(eventLimit(args.limit));
  },
});

export const getRecentAllEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const limit = eventLimit(args.limit);
    const [subscribers, payments, vouchers, tickets] = await Promise.all([
      ctx.db.query("subscriberEvents").withIndex("by_timestamp").order("desc").take(limit),
      ctx.db.query("paymentEvents").withIndex("by_timestamp").order("desc").take(limit),
      ctx.db.query("voucherEvents").withIndex("by_timestamp").order("desc").take(limit),
      ctx.db.query("ticketEvents").withIndex("by_timestamp").order("desc").take(limit),
    ]);

    return [
      ...subscribers.map((event) => ({ ...event, category: "subscriber" as const })),
      ...payments.map((event) => ({ ...event, category: "payment" as const })),
      ...vouchers.map((event) => ({ ...event, category: "voucher" as const })),
      ...tickets.map((event) => ({ ...event, category: "ticket" as const })),
    ]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, limit);
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

export const logWebhookDelivery = internalMutation({
  args: {
    eventType: v.string(),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveryLog", {
      receivedAt: Date.now(),
      eventType: args.eventType,
      signatureValid: args.signatureValid,
      processed: args.processed,
      errorMessage: args.errorMessage,
    });
  },
});

export const handleSubscriberEvent = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const p = args.payload;
    await ctx.db.insert("subscriberEvents", {
      centipidSubscriberId: p.subscriber_id ?? p.subscriberId ?? "",
      eventType: p.event_type ?? p.eventType ?? "unknown",
      phone: p.phone ?? "",
      name: p.name,
      packageName: p.package_name ?? p.packageName ?? "",
      timestamp: p.timestamp ?? Date.now(),
      rawPayloadRef: JSON.stringify(p).slice(0, 500),
    });
  },
});

export const handlePaymentEvent = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const p = args.payload;
    await ctx.db.insert("paymentEvents", {
      centipidPaymentId: p.payment_id ?? p.paymentId ?? "",
      eventType: p.event_type ?? p.eventType ?? "unknown",
      amount: p.amount ?? 0,
      currency: p.currency ?? "UGX",
      method: p.method ?? "unknown",
      subscriberPhone: p.subscriber_phone ?? p.subscriberPhone ?? "",
      timestamp: p.timestamp ?? Date.now(),
    });
  },
});

export const handleVoucherEvent = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const p = args.payload;
    await ctx.db.insert("voucherEvents", {
      centipidVoucherId: p.voucher_id ?? p.voucherId ?? "",
      eventType: p.event_type ?? p.eventType ?? "unknown",
      packageName: p.package_name ?? p.packageName ?? "",
      timestamp: p.timestamp ?? Date.now(),
    });
  },
});

export const handleTicketEvent = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const p = args.payload;
    await ctx.db.insert("ticketEvents", {
      centipidTicketId: p.ticket_id ?? p.ticketId ?? "",
      eventType: p.event_type ?? p.eventType ?? "unknown",
      subject: p.subject ?? "",
      timestamp: p.timestamp ?? Date.now(),
    });
  },
});
