import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

function platformOrganizationId(): string {
  const organizationId = process.env.MYLESNET_PLATFORM_ORG_ID;
  if (!organizationId) throw new Error("Platform organization is not configured");
  return organizationId;
}

// WorkOS role slugs in the MylesNet environment. These are emitted verbatim
// as the JWT `role` claim and must match the codebase `PlatformRole` values.
type WorkosRoleName =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "agent";

function workosAuth() {
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY is not configured");
  }
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

/**
 * Look up the caller's active organization membership in WorkOS, so callers
 * can mutate their own role. Throws if the user isn't a member of an org.
 */
async function getOwnMembership(ctx: ActionCtx): Promise<{
  membershipId: string;
  organizationId: string;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) throw new Error("WORKOS_API_KEY is not configured");

  const res = await fetch(
    `https://api.workos.com/user_management/users/${identity.subject}/organization_memberships`,
    { headers: workosAuth() },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch memberships: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; organization_id: string; status: string }>;
  };
  const active = data.data?.find((m) => m.status === "active");
  if (!active) {
    throw new Error("Not a member of any organization");
  }
  return { membershipId: active.id, organizationId: active.organization_id };
}

/** Set the caller's WorkOS organization membership role. */
export async function setOwnWorkosRole(ctx: ActionCtx, role: WorkosRoleName): Promise<void> {
  const { membershipId, organizationId } = await getOwnMembership(ctx);
  if (organizationId !== platformOrganizationId()) {
    throw new Error("Unauthorized organization membership");
  }
  const res = await fetch(
    `https://api.workos.com/user_management/organization_memberships/${membershipId}`,
    {
      method: "PUT",
      headers: workosAuth(),
      body: JSON.stringify({ role_slug: role }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update WorkOS role: ${res.status} ${body}`);
  }
}

/**
 * Ensures the authenticated WorkOS user is a member of the MylesNet Platform
 * organization. Called after first login. Idempotent — safe to call repeatedly.
 *
 * New non-owner users are added to the MylesNet Platform org with the
 * platform_admin role. This action calls the WorkOS API directly to create
 * the org membership, which causes WorkOS to include organization_id and
 * role in future JWTs.
 */
export const ensureOrgMembership = action({
  args: {},
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return { status: "unauthenticated" as const };
      }

      // A dashboard must never grant itself a privileged membership. WorkOS is
      // authoritative: accounts are invited by an owner outside this action.
      const orgId = identity["organization_id"];
      if (orgId) {
        await ctx.runMutation(internal.platformUsers.syncWorkosIdentity, {
          workosUserId: identity.subject,
          email: identity.email,
          name: typeof identity.name === "string" ? identity.name : undefined,
          image: typeof identity.picture === "string" ? identity.picture : undefined,
        });
        return { status: "already_member" as const, organizationId: orgId as string };
      }
      return { status: "not_member" as const };
    } catch {
      return { status: "error" as const, reason: "Identity synchronization could not be completed" };
    }
  },
});
