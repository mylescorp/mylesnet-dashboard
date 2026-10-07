"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/shared/components/ui";

type RoleRow = NonNullable<ReturnType<typeof useQuery<typeof api.rolesAdmin.listRoles>>>[number];
type UserRow = NonNullable<ReturnType<typeof useQuery<typeof api.platformUsers.listUsers>>>[number];
type InvitationRow = NonNullable<ReturnType<typeof useQuery<typeof api.invitations.listInvitations>>>[number];

export function PlatformAccess({ canReadInvitations }: { canReadInvitations: boolean }) {
  const roles = useQuery(api.rolesAdmin.listRoles, {});
  const users = useQuery(api.platformUsers.listUsers, {});
  const invitations = useQuery(api.invitations.listInvitations, canReadInvitations ? {} : "skip");
  const platformUsers = (users ?? []).filter((user) => user.roles.some((role) => role.isPlatform));

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Access & roles</h1>
          <p className="page-subtitle">Read-only summary of platform staff, roles, and pending invitations.</p>
        </div>
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
        <div className="section-heading"><div><p className="eyebrow">Staff</p><h2>Platform users</h2></div><span className="section-count">{platformUsers.length} users</span></div>
        {users === undefined ? <p className="pf-muted">Loading users…</p> : platformUsers.length === 0 ? <p className="pf-muted">No platform staff have been provisioned yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>User</th><th>Email</th><th>Roles</th></tr></thead><tbody>
            {platformUsers.map((platformUser: UserRow) => (
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
        {!canReadInvitations ? <p className="pf-muted">Invitation details require invitation management access.</p> : invitations === undefined ? <p className="pf-muted">Loading invitations…</p> : invitations.length === 0 ? <p className="pf-muted">No pending invitations.</p> : (
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
