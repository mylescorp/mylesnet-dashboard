import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Agent teams (spec "Teams"): grouping for campaigns, targets and leaderboard
 * views. Membership is append-only with leftAt markers (audit-friendly).
 */
export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "teams:read");
    const teams = await ctx.db.query("teams").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    const members = await ctx.db.query("teamMembers").collect();
    const agents = new Map((await ctx.db.query("agents").collect()).map((a) => [a._id, a.name]));
    return teams.map((team) => ({
      ...team,
      agents: members
        .filter((m) => m.teamId === team._id && m.leftAt === undefined)
        .map((m) => ({ memberId: m._id, agentId: m.agentId, agentName: agents.get(m.agentId as never) ?? m.agentId, joinedAt: m.joinedAt })),
    }));
  },
});

export const getTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    const members = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", args.teamId)).collect();
    return { ...team, members };
  },
});

export const createTeam = mutation({
  args: { name: v.string(), leaderAgentId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const id = await ctx.db.insert("teams", {
      name: args.name,
      leaderAgentId: args.leaderAgentId,
      status: "active",
      createdAt: Date.now(),
    });
    await logAudit(ctx, { action: "team.create", entityTable: "teams", entityId: id, changedBy: user._id, after: args });
    return id;
  },
});

export const updateTeam = mutation({
  args: { teamId: v.id("teams"), name: v.optional(v.string()), leaderAgentId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const { teamId: _teamId, ...patch } = args;
    await ctx.db.patch(args.teamId, patch);
    await logAudit(ctx, { action: "team.update", entityTable: "teams", entityId: args.teamId, changedBy: user._id, after: patch });
  },
});

export const removeTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    await ctx.db.patch(args.teamId, { status: "removed", removedAt: Date.now(), removedBy: user._id });
    await logAudit(ctx, { action: "team.remove", entityTable: "teams", entityId: args.teamId, changedBy: user._id });
  },
});

export const addTeamMember = mutation({
  args: { teamId: v.id("teams"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const team = await ctx.db.get(args.teamId);
    const agent = await ctx.db.get(args.agentId);
    if (!team || team.status !== "active") throw new Error("Team is not active");
    if (!agent) throw new Error("Agent not found");
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_member", (q) => q.eq("teamId", args.teamId).eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .first();
    if (existing) throw new Error("Agent already on this team");
    const id = await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      agentId: args.agentId,
      joinedAt: Date.now(),
    });
    await logAudit(ctx, { action: "team.addMember", entityTable: "teamMembers", entityId: id, changedBy: user._id });
    return id;
  },
});

export const removeTeamMember = mutation({
  args: { teamId: v.id("teams"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_member", (q) => q.eq("teamId", args.teamId).eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .first();
    if (!member) throw new Error("Agent is not on this team");
    await ctx.db.patch(member._id, { leftAt: Date.now() });
    await logAudit(ctx, { action: "team.removeMember", entityTable: "teamMembers", entityId: member._id, changedBy: user._id });
  },
});