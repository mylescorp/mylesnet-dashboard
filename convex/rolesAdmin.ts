import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getSystemRoleBySlug, PERMISSIONS, SYSTEM_ROLES, workosSlugForRole, ALL_PERMISSION_SLUGS, permissionInCatalog, CUSTOM_ROLE_DEFAULT_RANK } from "./lib/permissions";
import { requirePermission } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import {
  createWorkosOrganizationRole,
  deleteWorkosOrganizationRole,
  ensureWorkosPermission,
  getWorkosEnvironmentRoles,
  platformOrganizationIdForRoleSync,
  setWorkosOrganizationRolePermissions,
  updateWorkosOrganizationRole,
  WORKOS_AUTHKIT_BASELINE_PERMISSION,
} from "./workos";

export const rolePermissionValidator = v.array(v.string());

/** Seed the five system roles (idempotent). Safe to run at any time. */
export const seedLocalSystemRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const definition of SYSTEM_ROLES) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_slug", (q) => q.eq("slug", definition.slug))
        .first();
      if (existing) {
        // System roles are seeded as a baseline, not a recurring overwrite.
        // Administrators may now tailor their name, description and permission
        // set through the role editor. Keep their immutable identity fields and
        // WorkOS linkage intact when repairing a missing link.
        await ctx.db.patch(existing._id, {
          isPlatform: definition.isPlatform,
          rank: definition.rank,
          updatedAt: now,
          deletedAt: undefined,
          workosRoleSlug: definition.syncToWorkos ? definition.slug : undefined,
        });
      } else {
        await ctx.db.insert("roles", {
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          isSystem: true,
          isPlatform: definition.isPlatform,
          rank: definition.rank,
          permissions: definition.permissions,
          workosRoleSlug: definition.syncToWorkos ? definition.slug : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/** Fill `users.roles[]` from the legacy `platformRole` mirror (idempotent). */
export const backfillUserRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const systemSlugToRoleId = new Map<string, string>();
    for (const definition of SYSTEM_ROLES) {
      const role = await ctx.db.query("roles").withIndex("by_slug", (q) => q.eq("slug", definition.slug)).first();
      if (role) systemSlugToRoleId.set(definition.slug, role._id);
    }
    if (systemSlugToRoleId.size === 0) return { backfilled: 0 };

    const users = await ctx.db.query("users").collect();
    let backfilled = 0;
    for (const user of users) {
      if (user.roles && user.roles.length > 0) continue;
      const mirror = user.platformRole && systemSlugToRoleId.has(user.platformRole)
        ? user.platformRole
        : "network_operator";
      const roleId = systemSlugToRoleId.get(mirror);
      if (!roleId) continue;
      await ctx.db.patch(user._id, { roles: [roleId as never] });
      backfilled += 1;
    }
    return { backfilled };
  },
});

/**
 * Seed system roles in WorkOS/Convex + backfill legacy platformRole mirrors.
 * Runs the local seed first so the role registry always exists, then links
 * WorkOS environment role ids where present, and finally backfills users.
 */
export const ensureRoles = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runQuery(internal.rolesInternal.authorize, { permission: "roles:manage" });
    await ctx.runMutation(internal.rolesAdmin.seedLocalSystemRoles, {});

    let environmentRoles: { id: string; slug: string }[] = [];
    try {
      environmentRoles = await getWorkosEnvironmentRoles();
    } catch {
      environmentRoles = [];
    }

    const now = Date.now();
    for (const definition of SYSTEM_ROLES) {
      if (!definition.syncToWorkos) continue;
      const envRole = environmentRoles.find((role) => role.slug === definition.slug);
      const local = await ctx.runQuery(internal.rolesInternal.getRoleBySlug, { slug: definition.slug });
      if (local) {
        await ctx.runMutation(internal.rolesAdmin.patchSeededRole, {
          roleId: local._id,
          workosRoleId: envRole?.id,
          workosRoleSlug: definition.slug,
          updatedAt: now,
        });
      }
    }

    await ctx.runMutation(internal.rolesAdmin.backfillUserRoles, {});
    return { seeded: true };
  },
});

export const patchSeededRole = internalMutation({
  args: {
    roleId: v.id("roles"),
    workosRoleId: v.optional(v.string()),
    workosRoleSlug: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roleId, {
      workosRoleId: args.workosRoleId,
      workosRoleSlug: args.workosRoleSlug,
      updatedAt: args.updatedAt,
    });
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "roles:read");
    const roles = (await ctx.db.query("roles").collect())
      .filter((role) => role.deletedAt === undefined)
      .sort((left, right) => right.rank - left.rank || left.slug.localeCompare(right.slug));
    const users = await ctx.db.query("users").collect();
    return roles.map((role) => ({
      _id: role._id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      isPlatform: role.isPlatform,
      rank: role.rank,
      permissions: role.permissions,
      workosRoleSlug: role.workosRoleSlug ?? null,
      syncedToWorkos: role.isSystem
        ? role.workosRoleSlug !== undefined
        : role.workosRoleId !== undefined,
      assignedCount: users.filter((user) => (user.roles ?? []).includes(role._id)).length,
    }));
  },
});

export const getPermissionsCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "roles:read");
    return {
      permissions: PERMISSIONS,
      allSlugs: ALL_PERMISSION_SLUGS,
    };
  },
});

function validateRoleFields(name: string, slug: string, description?: string): void {
  if (!name.trim()) throw new Error("A role name is required.");
  if (name.length > 60) throw new Error("The role name is too long.");
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(slug)) {
    throw new Error("The role slug may only contain lowercase letters, digits, hyphens and underscores.");
  }
  if (getSystemRoleBySlug(slug)) throw new Error("This slug is reserved for a system role.");
  if (description !== undefined && description.length > 200) throw new Error("The description is too long.");
}

export const createRole = action({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: rolePermissionValidator,
  },
  handler: async (ctx, args) => {
    const actor = (await ctx.runQuery(internal.rolesInternal.authorize, { permission: "roles:manage" })) as {
      userId: Id<"users">;
      workosUserId: string | null;
      primaryRoleSlug: string;
    };
    const slug = args.slug.trim().toLowerCase();
    const name = args.name.trim();
    validateRoleFields(name, slug, args.description);

    const unknownPermissions = args.permissions.filter((permission) => !permissionInCatalog(permission));
    if (unknownPermissions.length > 0) throw new Error(`Unknown permission: ${unknownPermissions[0]}`);

    // Guard against duplicate slugs before touching WorkOS.
    const existing = (await ctx.runQuery(internal.rolesInternal.getRoleBySlug, { slug })) as Doc<"roles"> | null;
    if (existing) throw new Error("A role with this slug already exists.");

    const organizationId = platformOrganizationIdForRoleSync();

    // Custom roles must live in WorkOS as org-scoped roles with the org- prefix.
    const workosSlug = workosSlugForRole({ isSystem: false, slug });

    // Make sure every catalog permission exists in the WorkOS environment.
    for (const permission of PERMISSIONS) {
      await ensureWorkosPermission(permission.slug, permission.name);
    }

    const workosRoleId = await createWorkosOrganizationRole(organizationId, workosSlug, name, args.description);
    try {
      await setWorkosOrganizationRolePermissions(organizationId, workosSlug, [WORKOS_AUTHKIT_BASELINE_PERMISSION]);
    } catch {
      // WorkOS role-permission sync is best-effort; Convex remains authoritative.
    }

    const roleId = (await ctx.runMutation(internal.rolesAdmin.createRoleLocal, {
      name,
      slug,
      description: args.description?.trim() || undefined,
      permissions: Array.from(new Set(args.permissions)),
      rank: CUSTOM_ROLE_DEFAULT_RANK,
      workosRoleId,
      workosRoleSlug: workosSlug,
      createdByUserId: actor.userId,
    })) as Id<"roles">;

    await ctx.runMutation(internal.rolesAdmin.logRoleAudit, {
      action: "role.create",
      roleId,
      actorUserId: actor.userId,
      after: { name, slug, workosRoleId, permissions: args.permissions },
    });

    return roleId;
  },
});

export const createRoleLocal = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    rank: v.number(),
    workosRoleId: v.optional(v.string()),
    workosRoleSlug: v.optional(v.string()),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("roles").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (existing) throw new Error("A role with this slug already exists.");
    const now = Date.now();
    return ctx.db.insert("roles", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      isSystem: false,
      isPlatform: false,
      rank: args.rank,
      permissions: args.permissions,
      workosRoleId: args.workosRoleId,
      workosRoleSlug: args.workosRoleSlug,
      createdBy: args.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRole = action({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(rolePermissionValidator),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.runQuery(internal.rolesInternal.authorize, { permission: "roles:manage" });
    const role = await ctx.runQuery(internal.rolesInternal.getRoleById, { roleId: args.roleId });
    if (!role) throw new Error("Role not found.");

    const name = args.name !== undefined ? args.name.trim() : role.name;
    if (!name) throw new Error("A role name is required.");
    const description = args.description !== undefined ? args.description.trim() || undefined : role.description;
    const permissions = args.permissions !== undefined ? Array.from(new Set(args.permissions)) : role.permissions;
    for (const permission of permissions) {
      if (!permissionInCatalog(permission)) throw new Error(`Unknown permission: ${permission}`);
    }

    // Custom roles are organization-scoped in WorkOS. System roles are
    // environment roles, so their WorkOS identity remains stable while Convex
    // applies the edited permission set authoritatively at every request.
    if (!role.isSystem) {
      const organizationId = platformOrganizationIdForRoleSync();
      const workosSlug = role.workosRoleSlug ?? workosSlugForRole(role);
      try {
        await updateWorkosOrganizationRole(organizationId, workosSlug, name, description);
        await setWorkosOrganizationRolePermissions(organizationId, workosSlug, [WORKOS_AUTHKIT_BASELINE_PERMISSION]);
      } catch {
        // Convex remains authoritative if an organization role was removed in WorkOS.
      }
    }

    await ctx.runMutation(internal.rolesAdmin.updateRoleLocal, {
      roleId: args.roleId,
      name,
      description,
      permissions,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(internal.rolesAdmin.logRoleAudit, {
      action: "role.update",
      roleId: args.roleId,
      actorUserId: actor.userId,
      after: { name, permissions, systemRole: role.isSystem },
    });
    return args.roleId;
  },
});

export const updateRoleLocal = internalMutation({
  args: {
    roleId: v.id("roles"),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roleId, {
      name: args.name,
      description: args.description,
      permissions: args.permissions,
      updatedAt: args.updatedAt,
    });
  },
});

export const deleteRole = action({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const actor = await ctx.runQuery(internal.rolesInternal.authorize, { permission: "roles:manage" });
    const role = await ctx.runQuery(internal.rolesInternal.getRoleById, { roleId: args.roleId });
    if (!role) throw new Error("Role not found.");
    if (role.isSystem) throw new Error("System roles are protected from deletion. Edit their permissions instead.");

    const assignedCount = await ctx.runQuery(internal.rolesInternal.countRoleAssignments, { roleId: args.roleId });
    if (assignedCount > 0) {
      throw new Error("Reassign users before deleting this role.");
    }

    const organizationId = platformOrganizationIdForRoleSync();
    const workosSlug = role.workosRoleSlug ?? workosSlugForRole(role);
    try {
      await deleteWorkosOrganizationRole(organizationId, workosSlug);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/not found|404/i.test(message)) throw error;
    }

    await ctx.runMutation(internal.rolesAdmin.softDeleteRoleLocal, {
      roleId: args.roleId,
      actorUserId: actor.userId,
    });
    await ctx.runMutation(internal.rolesAdmin.logRoleAudit, {
      action: "role.delete",
      roleId: args.roleId,
      actorUserId: actor.userId,
      after: { name: role.name, slug: role.slug },
    });
    return args.roleId;
  },
});

export const softDeleteRoleLocal = internalMutation({
  args: { roleId: v.id("roles"), actorUserId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roleId, { deletedAt: Date.now(), deletedBy: args.actorUserId });
  },
});

export const logRoleAudit = internalMutation({
  args: {
    action: v.string(),
    roleId: v.id("roles"),
    actorUserId: v.id("users"),
    after: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      entityTable: "roles",
      entityId: args.roleId,
      changedBy: args.actorUserId,
      afterJson: args.after !== undefined ? JSON.stringify(args.after) : undefined,
      timestamp: Date.now(),
    });
  },
});

/** Internal roles backup of the roles-table name helper. */
export const getRoleIdsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.roles ?? [];
  },
});

/** Mutation-backed helper used by the webhook sync: ensure a user row exists. */
export const upsertWebhookUser = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.workosUserId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email?.toLowerCase() ?? existing.email,
        name: args.name ?? existing.name,
        image: args.image ?? existing.image,
        isActive: existing.isActive ?? true,
        deactivatedAt: undefined,
      });
      return existing._id;
    }
    const byEmail = args.email
      ? await ctx.db.query("users").withIndex("email", (q) => q.eq("email", args.email!.toLowerCase())).first()
      : null;
    if (byEmail) {
      await ctx.db.patch(byEmail._id, {
        workosUserId: args.workosUserId,
        isActive: byEmail.isActive ?? true,
        deactivatedAt: undefined,
      });
      return byEmail._id;
    }
    return ctx.db.insert("users", {
      workosUserId: args.workosUserId,
      email: args.email?.toLowerCase(),
      name: args.name,
      image: args.image,
      isActive: true,
    });
  },
});
