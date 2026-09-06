import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireInvestorViewer, requirePermission, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { dayOf } from "./lib/finance";

/**
 * Investor management + frozen reports (spec §31). The investor portal is a
 * fast-follow; the backend already supports: investor records, report
 * snapshots, and read-only access via the investor_viewer role.
 */
export const listInvestors = query({
  args: {},
  handler: async (ctx) => {
    await requireInvestorViewer(ctx);
    return (await ctx.db.query("investors").collect()).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createInvestor = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    investmentAmountUSD: v.number(),
    investmentDate: v.string(),
    equityPercent: v.optional(v.number()),
    instrumentType: v.union(v.literal("equity"), v.literal("safe"), v.literal("loan"), v.literal("revenue_share")),
    reportFrequency: v.union(v.literal("weekly"), v.literal("monthly")),
    userId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "investors:manage");
    const id = await ctx.db.insert("investors", {
      userId: args.userId,
      name: args.name,
      email: args.email.toLowerCase(),
      investmentAmountUSD: args.investmentAmountUSD,
      investmentDate: args.investmentDate,
      equityPercent: args.equityPercent,
      instrumentType: args.instrumentType,
      status: "active",
      reportFrequency: args.reportFrequency,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "investor.create",
      entityTable: "investors",
      entityId: id,
      changedBy: user._id,
      after: { name: args.name, amountUSD: args.investmentAmountUSD },
    });
    return id;
  },
});

export const updateInvestor = mutation({
  args: {
    investorId: v.id("investors"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    instrumentType: v.optional(v.union(v.literal("equity"), v.literal("safe"), v.literal("loan"), v.literal("revenue_share"))),
    reportFrequency: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))),
    status: v.optional(v.union(v.literal("active"), v.literal("exited"), v.literal("removed"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "investors:manage");
    const investor = await ctx.db.get(args.investorId);
    if (!investor) throw new Error("Investor not found");
    const { investorId: _investorId, ...patch } = args;
    await ctx.db.patch(args.investorId, { ...patch, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "investor.update",
      entityTable: "investors",
      entityId: args.investorId,
      changedBy: user._id,
      after: patch,
    });
  },
});

/** Frozen snapshot of the portfolio (spec §31). Idempotent per investor+period. */
export const generateInvestorReport = internalMutation({
  args: { investorId: v.id("investors"), period: v.string() },
  handler: async (ctx, args) => {
    const investor = await ctx.db.get(args.investorId);
    if (!investor || investor.status !== "active") throw new Error("Investor not active");

    const financials = await ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", args.period)).collect();
    const snapshots = (await ctx.db.query("dailySnapshots").collect()).filter((s) => s.date.startsWith(args.period));

    const snapshot = {
      generatedAt: Date.now(),
      investor: {
        name: investor.name,
        instrumentType: investor.instrumentType,
        investmentAmountUSD: investor.investmentAmountUSD,
        equityPercent: investor.equityPercent,
        reportFrequency: investor.reportFrequency,
      },
      period: args.period,
      markets: financials.map((f) => ({
        marketId: f.marketId,
        revenueLocal: f.revenueLocal,
        revenueUSD: f.revenueUSD,
        netContributionLocal: f.netContributionLocal,
        breakEvenStatus: f.breakEvenStatus,
        currency: f.currency,
      })),
      dailyPoints: snapshots
        .map((s) => ({ marketId: s.marketId, date: s.date, revenueLocal: s.revenueLocal, netContributionLocal: s.netContributionLocal }))
        .slice(0, 31),
    };

    const existing = await ctx.db
      .query("investorReports")
      .withIndex("by_investor", (q) => q.eq("investorId", args.investorId))
      .filter((q) => q.eq(q.field("period"), args.period))
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, {
        investorId: args.investorId,
        period: args.period,
        snapshot,
        generatedAt: Date.now(),
        sentAt: undefined,
        viewedAt: existing.viewedAt,
      });
      return { updated: true, id: existing._id };
    }
    const id = await ctx.db.insert("investorReports", {
      investorId: args.investorId,
      period: args.period,
      snapshot,
      generatedAt: Date.now(),
    });
    return { updated: false, id };
  },
});

export const listInvestorReports = query({
  args: { investorId: v.optional(v.id("investors")) },
  handler: async (ctx, args) => {
    await requireInvestorViewer(ctx);
    const rows = args.investorId
      ? await ctx.db.query("investorReports").withIndex("by_investor", (q) => q.eq("investorId", args.investorId)).collect()
      : await ctx.db.query("investorReports").collect();
    return rows.sort((a, b) => b.period.localeCompare(a.period));
  },
});

export const markInvestorReportViewed = mutation({
  args: { reportId: v.id("investorReports") },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    await ctx.db.patch(args.reportId, { viewedAt: Date.now() });
    await logAudit(ctx, { action: "investorReport.viewed", entityTable: "investorReports", entityId: args.reportId, changedBy: user._id });
  },
});

/** Company overview for the investor dashboard (read-only aggregation). */
export const getInvestorOverview = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireInvestorViewer(ctx);
    const month = args.month ?? dayOf(Date.now()).slice(0, 7);
    const financials = await ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", month)).collect();
    const markets = await ctx.db.query("markets").collect();
    const investors = await ctx.db.query("investors").collect();
    const totalMonthlyRevenueUSD = financials.reduce((sum, f) => sum + f.revenueUSD, 0);
    const totalNetContributionLocal = financials.reduce((sum, f) => sum + f.netContributionLocal, 0);
    const totalInvestmentUSD = investors.filter((i) => i.status === "active").reduce((sum, i) => sum + i.investmentAmountUSD, 0);
    return {
      month,
      totalMonthlyRevenueUSD,
      totalNetContributionLocal,
      marketCount: markets.length,
      activeInvestorCount: investors.filter((i) => i.status === "active").length,
      totalInvestmentUSD,
      perMarket: financials.map((f) => ({
        marketId: f.marketId,
        marketName: markets.find((m) => m._id === f.marketId)?.name ?? f.marketId,
        revenueUSD: f.revenueUSD,
        netContributionLocal: f.netContributionLocal,
        status: f.breakEvenStatus,
      })),
    };
  },
});