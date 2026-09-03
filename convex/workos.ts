import { action, ActionCtx } from "./_generated/server";

const MYLESNET_PLATFORM_ORG_ID = "org_01KWQ9Q1T5WKX4KEDWPVJ395Y4";

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
  const { membershipId } = await getOwnMembership(ctx);
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

      // If the JWT already has organization_id, the user is already a member
      const orgId = identity["organization_id"];
      if (orgId) {
        return { status: "already_member" as const, organizationId: orgId as string };
      }

      // Check for WORKOS_API_KEY BEFORE attempting WorkOS API calls
      const apiKey = process.env.WORKOS_API_KEY;
      if (!apiKey) {
        console.warn("WORKOS_API_KEY is not configured in Convex environment variables.");
        return { status: "skipped" as const, reason: "WORKOS_API_KEY is not configured" };
      }

      const workosUserId = identity.subject;
      if (!workosUserId || !workosUserId.startsWith("user_")) {
        console.warn(`identity.subject "${workosUserId}" is not a valid WorkOS user ID`);
        return { status: "skipped" as const, reason: "Non-WorkOS identity subject" };
      }

      const membershipsRes = await fetch(
        `https://api.workos.com/user_management/users/${workosUserId}/organization_memberships`,
        { headers: workosAuth() },
      );

      if (membershipsRes.ok) {
        const membershipsData = (await membershipsRes.json()) as {
          data?: Array<{ organization_id: string; status: string }>;
        };
        const existingMembership = membershipsData.data?.find(
          (m) => m.organization_id === MYLESNET_PLATFORM_ORG_ID || m.status === "active" || !!m.organization_id
        );
        if (existingMembership) {
          return { status: "already_member" as const, organizationId: existingMembership.organization_id };
        }
      } else {
        const errText = await membershipsRes.text();
        console.warn(`WorkOS list memberships returned status ${membershipsRes.status}: ${errText}`);
      }

      const addRes = await fetch("https://api.workos.com/user_management/organization_memberships", {
        method: "POST",
        headers: workosAuth(),
        body: JSON.stringify({
          user_id: workosUserId,
          organization_id: MYLESNET_PLATFORM_ORG_ID,
          role_slug: "platform_admin",
        }),
      });

      if (!addRes.ok) {
        const body = await addRes.text();
        if (
          addRes.status === 400 ||
          addRes.status === 409 ||
          body.includes("already_exists") ||
          body.includes("already a member")
        ) {
          return { status: "already_member" as const, organizationId: MYLESNET_PLATFORM_ORG_ID };
        }
        console.warn(`WorkOS add membership status ${addRes.status}: ${body}`);
        return { status: "error" as const, reason: `Failed to add user to organization: ${addRes.status} ${body}` };
      }

      return { status: "added" as const, organizationId: MYLESNET_PLATFORM_ORG_ID };
    } catch (err: any) {
      console.warn("Handled exception in ensureOrgMembership action:", err);
      return { status: "error" as const, reason: err?.message || String(err) };
    }
  },
});