import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { permissionsOf as collectPermissions, requireAuthenticatedUser, requirePlatformAdmin, resolveRoles, resolveUserByIdentity } from "./lib/auth";
import {
  decryptCentipidSecret,
  encryptCentipidSecret,
} from "./lib/centipidCredentials";
import {
  extractEventType,
  mcpTextContents,
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
    return { role: primary?.slug ?? null, isPlatform: roles.some((role) => role.isPlatform) };
  },
});

export const getCentipidSettingsView = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const creds = await ctx.db.query("centipidCredentials").order("desc").first();
    return {
      hasCredentials: !!creds,
      ingestionPaused: creds?.ingestionPaused === true,
      webhookUrl: webhookUrlFromSite(),
      encryptionConfigured: !!process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY,
    };
  },
});

export const saveCentipidCredentials = mutation({
  args: {
    apiToken: v.string(),
    webhookSigningSecret: v.string(),
    ingestionPaused: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const token = args.apiToken.trim();
    const secret = args.webhookSigningSecret.trim();
    if (!token) throw new Error("The Centipid API token is required.");
    if (!secret) throw new Error("The webhook signing secret is required.");

    const encryptedToken = await encryptCentipidSecret(token);
    const encryptedSecret = await encryptCentipidSecret(secret);

    const existing = await ctx.db.query("centipidCredentials").order("desc").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        apiToken: encryptedToken,
        webhookSigningSecret: encryptedSecret,
        ingestionPaused: args.ingestionPaused ?? existing.ingestionPaused ?? false,
      });
    } else {
      await ctx.db.insert("centipidCredentials", {
        apiToken: encryptedToken,
        webhookSigningSecret: encryptedSecret,
        ingestionPaused: args.ingestionPaused ?? false,
        createdAt: Date.now(),
      });
    }
    return { saved: true };
  },
});

export const setCentipidIngestionPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const existing = await ctx.db.query("centipidCredentials").order("desc").first();
    if (!existing) throw new Error("Configure credentials before pausing ingestion.");
    await ctx.db.patch(existing._id, { ingestionPaused: args.paused });
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

    const [pausedSubscribers, openTickets] = await Promise.all([
      ctx.db.query("latestSubscriberState").withIndex("by_status", (q) => q.eq("status", "paused")).collect(),
      ctx.db.query("ticketStatus").withIndex("by_status", (q) => q.eq("status", "open")).collect(),
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

export const handleSubscriberEvent = internalMutation({
  args: { payload: v.any(), webhookEventId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const eventType = extractEventType(args.payload) ?? "subscriber.unknown";
    if (await alreadyProcessed(ctx, "subscriberEvents", args.webhookEventId)) return { inserted: false };
    const p = args.payload as Record<string, unknown>;
    const subscriberId =
      pickString(p, ["subscriber_id", "subscriberId", "id", "account", "username"]) ||
      pickString(p.data as Record<string, unknown>, ["subscriber_id", "subscriberId", "id", "account"]) ||
      "";
    const phone =
      pickString(p, ["phone", "mobile", "msisdn"]) ||
      pickString(p.data as Record<string, unknown>, ["phone", "mobile", "msisdn"]) ||
      "";

    const row = {
      centipidSubscriberId: subscriberId,
      eventType,
      phone,
      name:
        pickString(p, ["name", "customer_name", "full_name"]) ||
        pickString(p.data as Record<string, unknown>, ["name", "customer_name", "full_name"]) || undefined,
      packageName:
        pickString(p, ["package_name", "packageName", "package"]) ||
        pickString(p.data as Record<string, unknown>, ["package_name", "packageName", "package"]) ||
        "",
      timestamp:
        typeof p.timestamp === "number"
          ? p.timestamp
          : typeof p.timestamp === "string"
            ? Date.parse(p.timestamp) || Date.now()
            : Date.now(),
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
    const p = args.payload as Record<string, unknown>;
    const rawAmount = p.amount ?? (p.data as Record<string, unknown> | null)?.["amount"];
    const amount = Number(rawAmount);
    await ctx.db.insert("paymentEvents", {
      centipidPaymentId:
        pickString(p, ["payment_id", "paymentId", "id", "reference", "transaction_id"]) ||
        pickString(p.data as Record<string, unknown>, ["payment_id", "paymentId", "id", "reference"]) ||
        "",
      eventType,
      amount: Number.isFinite(amount) ? amount : 0,
      currency:
        pickString(p, ["currency", "ccy"]) ||
        pickString(p.data as Record<string, unknown>, ["currency", "ccy"]) ||
        "UGX",
      method:
        pickString(p, ["method", "channel", "payment_method"]) ||
        pickString(p.data as Record<string, unknown>, ["method", "channel", "payment_method"]) ||
        "unknown",
      subscriberPhone:
        pickString(p, ["subscriber_phone", "subscriberPhone", "phone", "mobile"]) ||
        pickString(p.data as Record<string, unknown>, ["subscriber_phone", "subscriberPhone", "phone", "mobile"]) ||
        "",
      timestamp:
        typeof p.timestamp === "number"
          ? p.timestamp
          : typeof p.timestamp === "string"
            ? Date.parse(p.timestamp) || Date.now()
            : Date.now(),
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
    const p = args.payload as Record<string, unknown>;
    const phone =
      pickString(p, ["phone", "mobile", "customer_phone", "customerPhone"]) ||
      pickString(p.data as Record<string, unknown>, ["phone", "mobile", "customer_phone", "customerPhone"]) ||
      undefined;
    await ctx.db.insert("voucherEvents", {
      centipidVoucherId:
        pickString(p, ["voucher_id", "voucherId", "id", "code"]) ||
        pickString(p.data as Record<string, unknown>, ["voucher_id", "voucherId", "id", "code"]) ||
        "",
      eventType,
      packageName:
        pickString(p, ["package_name", "packageName", "package"]) ||
        pickString(p.data as Record<string, unknown>, ["package_name", "packageName", "package"]) ||
        "",
      timestamp:
        typeof p.timestamp === "number"
          ? p.timestamp
          : typeof p.timestamp === "string"
            ? Date.parse(p.timestamp) || Date.now()
            : Date.now(),
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
    const p = args.payload as Record<string, unknown>;
    const ticketId =
      pickString(p, ["ticket_id", "ticketId", "id"]) ||
      pickString(p.data as Record<string, unknown>, ["ticket_id", "ticketId", "id"]) ||
      "";
    const subject =
      pickString(p, ["subject", "title"]) ||
      pickString(p.data as Record<string, unknown>, ["subject", "title"]) ||
      "";
    const timestamp =
      typeof p.timestamp === "number"
        ? p.timestamp
        : typeof p.timestamp === "string"
          ? Date.parse(p.timestamp) || Date.now()
          : Date.now();

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
  runQuery: (fn: typeof internal.centipid.getCallerRole, args: Record<string, never>) => Promise<{ role: string | null; isPlatform: boolean } | null>;
}): Promise<void> {
  const caller = await ctx.runQuery(internal.centipid.getCallerRole, {});
  if (!caller || (caller.role !== "platform_owner" && caller.role !== "platform_admin")) {
    throw new Error("Unauthorized: admin role required");
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

export const fetchHistoricalCentipidData = action({
  args: {},
  handler: async (ctx) => {
    await requireAdminCaller(ctx);
    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    if (!creds) throw new Error("No Centipid credentials are configured.");
    const token = await decryptCentipidSecret(creds.apiToken);

    type CentipidEntry =
      | { kind: "subscriber"; payload: { subscriber_id: string; phone: string; name?: unknown; package_name: string; timestamp: number } }
      | { kind: "payment"; payload: { payment_id: string; amount: number; currency: string; method: string; subscriber_phone: string; timestamp: number } }
      | { kind: "voucher"; payload: { voucher_id: string; package_name: string; timestamp: number } }
      | { kind: "ticket"; payload: { ticket_id: string; subject: string; timestamp: number } };

    const tools: Array<[string, (item: Record<string, unknown>) => CentipidEntry]> = [
      ["list_subscribers", (item) => ({
        kind: "subscriber" as const,
        payload: {
          subscriber_id: (item.id ?? item.subscriber_id ?? "") as string,
          phone: (item.phone ?? item.mobile ?? "") as string,
          name: item.name ?? item.customer_name,
          package_name: (item.package ?? item.package_name ?? "") as string,
          timestamp: Date.parse(String(item.created_at ?? "")) || Date.now(),
        },
      })],
      ["payments_report", (item) => ({
        kind: "payment" as const,
        payload: {
          payment_id: (item.id ?? item.payment_id ?? item.reference ?? "") as string,
          amount: Number(item.amount ?? 0),
          currency: (item.currency ?? "UGX") as string,
          method: (item.method ?? item.channel ?? "unknown") as string,
          subscriber_phone: (item.phone ?? item.subscriber_phone ?? "") as string,
          timestamp: Date.parse(String(item.created_at ?? item.timestamp ?? "")) || Date.now(),
        },
      })],
      ["voucher_stock", (item) => ({
        kind: "voucher" as const,
        payload: {
          voucher_id: (item.id ?? item.voucher_id ?? item.code ?? "") as string,
          package_name: (item.package ?? item.package_name ?? "") as string,
          timestamp: Date.parse(String(item.created_at ?? "")) || Date.now(),
        },
      })],
      ["open_tickets", (item) => ({
        kind: "ticket" as const,
        payload: {
          ticket_id: (item.id ?? item.ticket_id ?? "") as string,
          subject: (item.subject ?? item.title ?? "") as string,
          timestamp: Date.parse(String(item.created_at ?? "")) || Date.now(),
        },
      })],
    ];

    const report: { tool: string; inserted: number; error?: string }[] = [];
    for (const [toolName, normalize] of tools) {
      try {
        const contents = await runMcpTool(token, toolName, {});
        let inserted = 0;
        for (const content of contents) {
          let items: Array<Record<string, unknown>> = [];
          try {
            const parsed = JSON.parse(content);
            items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : parsed?.data && Array.isArray(parsed.data) ? parsed.data : [];
          } catch {
            items = [];
          }
          for (const item of items) {
            const entry = normalize(item);
            const eventType =
              entry.kind === "subscriber"
                ? "subscriber.created"
                : entry.kind === "payment"
                  ? "payment.received"
                  : entry.kind === "voucher"
                    ? "voucher.generated"
                    : "ticket.opened";
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
    return { report };
  },
});

export const seedCentipidEventsForTesting = mutation({
  args: { count: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
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