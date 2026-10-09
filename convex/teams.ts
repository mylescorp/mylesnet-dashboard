import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { readTenantList, enforceTenantOnResource, readScopedTenant } from "./lib/tenant";
import { logAudit } from "./lib/auditLog";

/**
 * Agent teams (spec "Teams"): grouping for campaigns, targets and leaderboard
 * views. Membership is append-only with leftAt markers (audit-friendly).
 */
export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "teams:read");
    const readTeams = () =>
      readTenantList<Doc<"teams">>(ctx, {
        all: () => ctx.db.query("teams").collect(),
        tenant: (tenantId) =>
          ctx.db.query("teams").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        legacy: () =>
          ctx.db.query("teams").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
      });
    const readMembers = () =>
      readTenantList<Doc<"teamMembers">>(ctx, {
        all: () => ctx.db.query("teamMembers").collect(),
        tenant: (tenantId) =>
          ctx.db.query("teamMembers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        legacy: () =>
          ctx.db.query("teamMembers").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
      });
    const readAgents = () =>
      readTenantList<Doc<"agents">>(ctx, {
        all: () => ctx.db.query("agents").collect(),
        tenant: (tenantId) =>
          ctx.db.query("agents").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        legacy: () =>
          ctx.db.query("agents").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
      });
    const teams = (await readTeams()).filter((t) => t.status === "active");
    const members = await readMembers();
    const agents = new Map((await readAgents()).map((a) => [a._id, a.name]));
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
    await requirePermission(ctx, "teams:read");
    const team = await enforceTenantOnResource(ctx, await ctx.db.get(args.teamId), "team");
    if (!team) throw new Error("Team not found");
    const members = (
      await readTenantList<Doc<"teamMembers">>(ctx, {
        all: () => ctx.db.query("teamMembers").collect(),
        tenant: (tenantId) =>
          ctx.db.query("teamMembers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        legacy: () =>
          ctx.db.query("teamMembers").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
      })
    ).filter((m) => m.teamId === args.teamId);
    return { ...team, members };
  },
});

export const createTeam = mutation({
  args: { name: v.string(), leaderAgentId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const scope = await readScopedTenant(ctx);
    const leader = args.leaderAgentId ? await ctx.db.get(args.leaderAgentId) : null;
    if (args.leaderAgentId && (!leader || (scope.enforced && leader.tenantId !== scope.tenantId))) throw new Error("Agent not found");
    const id = await ctx.db.insert("teams", {
      tenantId: scope.enforced ? scope.tenantId ?? undefined : undefined,
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
    const scope = await readScopedTenant(ctx);
    const team = await enforceTenantOnResource(ctx, await ctx.db.get(args.teamId), "team");
    if (!team) throw new Error("Team not found");
    if (args.leaderAgentId) {
      const leader = await ctx.db.get(args.leaderAgentId);
      if (!leader || (scope.enforced && leader.tenantId !== scope.tenantId)) throw new Error("Agent not found");
    }
    const patch = { name: args.name, leaderAgentId: args.leaderAgentId };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await ctx.db.patch(args.teamId, cleaned);
    await logAudit(ctx, { action: "team.update", entityTable: "teams", entityId: args.teamId, changedBy: user._id, after: cleaned });
  },
});

export const removeTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const team = await enforceTenantOnResource(ctx, await ctx.db.get(args.teamId), "team");
    if (!team) throw new Error("Team not found");
    await ctx.db.patch(args.teamId, { status: "removed", removedAt: Date.now(), removedBy: user._id });
    await logAudit(ctx, { action: "team.remove", entityTable: "teams", entityId: args.teamId, changedBy: user._id });
  },
});

export const addTeamMember = mutation({
  args: { teamId: v.id("teams"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "teams:manage");
    const scope = await readScopedTenant(ctx);
    const team = await enforceTenantOnResource(ctx, await ctx.db.get(args.teamId), "team");
    const agent = await enforceTenantOnResource(ctx, await ctx.db.get(args.agentId), "agent");
    if (!team || team.status !== "active") throw new Error("Team is not active");
    if (!agent) throw new Error("Agent not found");
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_member", (q) => q.eq("teamId", args.teamId).eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .first();
    if (existing) throw new Error("Agent already on this team");
    const id = await ctx.db.insert("teamMembers", {
      tenantId: scope.enforced ? scope.tenantId ?? undefined : team.tenantId,
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
    const team = await enforceTenantOnResource(ctx, await ctx.db.get(args.teamId), "team");
    const agent = await enforceTenantOnResource(ctx, await ctx.db.get(args.agentId), "agent");
    if (!team || !agent) throw new Error("Team member not found");
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_member", (q) => q.eq("teamId", args.teamId).eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .first();
    if (!member || member.tenantId !== team.tenantId) throw new Error("Agent is not on this team");
    await ctx.db.patch(member._id, { leftAt: Date.now() });
    await logAudit(ctx, { action: "team.removeMember", entityTable: "teamMembers", entityId: member._id, changedBy: user._id });
  },
});
