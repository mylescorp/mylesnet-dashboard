"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/shared/components/ui";

type RoleRow = NonNullable<ReturnType<typeof useQuery<typeof api.rolesAdmin.listRoles>>>[number];
type UserRow = NonNullable<ReturnType<typeof useQuery<typeof api.platformUsers.listUsers>>>[number];
type InvitationRow = NonNullable<ReturnType<typeof useQuery<typeof api.invitations.listInvitations>>>[number];

export function PlatformAccess() {
  const roles = useQuery(api.rolesAdmin.listRoles, {});
  const users = useQuery(api.platformUsers.listUsers, {});
  const invitations = useQuery(api.invitations.listInvitations, {});

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Access & roles</h1>
          <p className="page-subtitle">Read-only summary of platform staff, role definitions, and pending invitations. Full create and edit operations remain on the /access surface.</p>
        </div>
        <Link className="secondary-button" href="/access"><ExternalLink size={16} aria-hidden="true" />Full management</Link>
      </header>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Role catalog</p><h2>Platform roles</h2></div><span className="section-count">{roles?.length ?? 0} roles</span></div>
        {roles === undefined ? <p className="pf-muted">Loading roles…</p> : roles.length === 0 ? <p className="pf-muted">No roles are defined yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Role</th><th>Slug</th><th>Type</th><th>Rank</th><th>Permissions</th></tr></thead><tbody>
            {roles.map((role: RoleRow) => (
              <tr key={role._id}>
                <td><strong>{role.name}</strong>{role.description ? <small className="table-subtext">{role.description}</small> : null}</td>
                <td><code>{role.slug}</code></td>
                <td>{role.isPlatform ? "Platform" : "Workspace"}</td>
                <td>{role.rank}</td>
                <td><span className="role-permission-count">{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</span></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Staff</p><h2>Platform users</h2></div><span className="section-count">{users?.length ?? 0} users</span></div>
        {users === undefined ? <p className="pf-muted">Loading users…</p> : users.length === 0 ? <p className="pf-muted">No users have been provisioned yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>User</th><th>Email</th><th>Roles</th></tr></thead><tbody>
            {users.map((platformUser: UserRow) => (
              <tr key={platformUser._id}>
                <td><strong>{platformUser.name ?? "Unnamed user"}</strong></td>
                <td>{platformUser.email}</td>
                <td>{platformUser.roles?.map((role) => role.name).join(", ") ?? "—"}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Invitations</p><h2>Pending invites</h2></div><span className="section-count">{invitations?.length ?? 0} pending</span></div>
        {invitations === undefined ? <p className="pf-muted">Loading invitations…</p> : invitations.length === 0 ? <p className="pf-muted">No pending invitations.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Sent</th></tr></thead><tbody>
            {invitations.map((invitation: InvitationRow) => (
              <tr key={invitation._id}>
                <td><strong>{invitation.email}</strong></td>
                <td>{invitation.roleName ?? invitation.roleSlug ?? "—"}</td>
                <td><span className={`status-pill status-pill-${invitation.status === "pending" ? "warning" : "neutral"}`}>{invitation.status}</span></td>
                <td>{formatDateTime(invitation.createdAt)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
