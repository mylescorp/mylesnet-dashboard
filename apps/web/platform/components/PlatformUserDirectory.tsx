"use client";

import { useState } from "react";
import { useAction, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { platformUserDirectory } from "@/shared/convex/platformUserDirectory";
import type { DirectoryUser } from "@/shared/convex/platformUserDirectory";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { hasAnyRole } from "@/shared/auth/rbac";

export function PlatformUserDirectory() {
  const { user } = useUserProfile();
  const roleSlugs = user?.roles.map((role) => role.slug) ?? [];
  const isSuperAdmin = hasAnyRole(roleSlugs, ["platform_super_admin", "platform_owner", "platform_admin"]);
  const isSupport = hasAnyRole(roleSlugs, ["platform_support"]);
  const [searchInput, setSearchInput] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const page = useQuery(platformUserDirectory.list, {
    paginationOpts: { numItems: 25, cursor },
    email: searchEmail || undefined,
  });
  const updateMembership = useAction(platformUserDirectory.updateMembership);
  const sendPasswordReset = useAction(platformUserDirectory.sendPasswordReset);

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursor(null);
    setSearchEmail(searchInput.trim().toLowerCase());
    setMessage("");
    setError("");
  }

  function browseAll() {
    setSearchEmail("");
    setSearchInput("");
    setCursor(null);
    setMessage("");
    setError("");
  }

  async function changeMembership(target: DirectoryUser, tenantId: string, next: "active" | "revoked", tenantName: string) {
    const actionKey = target._id + ":" + tenantId;
    const verb = next === "revoked" ? "Disable" : "Restore";
    if (!window.confirm(verb + " " + (target.name || target.email || "this user's") + " access to " + tenantName + "?")) return;
    setWorking(actionKey);
    setError("");
    setMessage("");
    try {
      await updateMembership({ userId: target._id, tenantId, status: next, requestId: crypto.randomUUID() });
      setMessage(next === "revoked" ? "Access to " + tenantName + " was disabled." : "Access to " + tenantName + " was restored.");
    } catch (cause) {
      setError(userFacingMessage(cause, "Workspace access could not be changed."));
    } finally {
      setWorking(null);
    }
  }

  async function resetPassword(target: DirectoryUser) {
    if (!target.email || !window.confirm("Send password reset instructions to " + target.email + "?")) return;
    setWorking(target._id);
    setError("");
    setMessage("");
    try {
      await sendPasswordReset({ userId: target._id });
      setMessage("Password reset instructions were sent to " + target.email + ".");
    } catch (cause) {
      setError(userFacingMessage(cause, "Password reset instructions could not be sent."));
    } finally {
      setWorking(null);
    }
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform access</p><h1 className="page-title">Global user directory</h1><p className="page-subtitle">Find user accounts and review their workspace access across the platform.</p></div></header>
    <p className="pf-hint">Support can disable workspace access and request password resets for end-tenant users. Restoring access requires a platform super-admin. Platform staff access remains managed in Access &amp; roles.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}
    {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

    <section className="pf-panel">
      <form className="access-toolbar" onSubmit={search}>
        <label className="access-search"><span className="sr-only">Find a user by email</span><input type="email" required value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Find a user by email" /></label>
        <button type="submit" className="primary-button">Search</button>
        {searchEmail ? <button type="button" className="secondary-button" onClick={browseAll}>Browse directory</button> : null}
        <div className="access-toolbar-spacer" />
        <span className="pf-muted">{searchEmail ? "Exact email match" : "Most recently added accounts"}</span>
      </form>
      <div className="section-heading"><div><p className="eyebrow">Directory</p><h2>{searchEmail ? "Search result" : "User accounts"}</h2></div><span className="section-count">{page?.items.length ?? 0} shown</span></div>
      {page === undefined ? <p className="pf-muted">Loading user directory…</p> : page.items.length === 0 ? <EmptyState title={searchEmail ? "No matching user" : "No users found"} body={searchEmail ? "Check the email address and try again." : "No user accounts are available in this directory."} /> : (
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>User</th><th>Account status</th><th>Workspace access</th><th>Actions</th></tr></thead><tbody>
          {page.items.map((target) => {
            const platformIdentity = target.platformRoles.length > 0;
            const canSupportAct = isSupport && !platformIdentity && target.tenantMemberships.length > 0 && target.status === "active";
            const canReset = Boolean(target.email && target.status === "active" && (isSuperAdmin || canSupportAct));
            return <tr key={target._id}>
              <td><strong>{target.name || "Unnamed user"}</strong><small className="table-subtext">{target.email || "No email on file"}{target.phone ? " · " + target.phone : ""}{target.platformRoles.length ? " · " + target.platformRoles.join(", ") : ""}</small></td>
              <td><StatusPill tone={target.status === "active" ? "success" : target.status === "disabled" ? "warning" : "neutral"}>{target.status}</StatusPill></td>
              <td>{target.tenantMemberships.length === 0 ? <span className="pf-muted">{platformIdentity ? "Platform staff access is managed separately" : "No workspace memberships"}</span> : <div className="directory-memberships">{target.tenantMemberships.map((membership) => <div className="directory-membership" key={target._id + ":" + membership.tenantId}><span><strong>{membership.tenantName}</strong><small className="table-subtext">{membership.role} · {membership.status}</small></span>{membership.status === "active" && (isSuperAdmin || canSupportAct) ? <button type="button" className="secondary-button danger" disabled={working !== null} onClick={() => void changeMembership(target, membership.tenantId, "revoked", membership.tenantName)}>Disable access</button> : membership.status === "revoked" && isSuperAdmin ? <button type="button" className="secondary-button" disabled={working !== null} onClick={() => void changeMembership(target, membership.tenantId, "active", membership.tenantName)}>Restore access</button> : null}</div>)}{target.hasMoreTenantMemberships ? <small className="pf-muted">Only the first 50 workspace memberships are shown.</small> : null}</div>}</td>
              <td>{canReset ? <button type="button" className="secondary-button" disabled={working !== null} onClick={() => void resetPassword(target)}>Send reset instructions</button> : "—"}</td>
            </tr>;
          })}
        </tbody></table></div>
      )}
      {!searchEmail && page ? <div className="modal-actions"><span className="pf-muted">{page.isDone ? "End of directory" : "More accounts available"}</span><button type="button" className="secondary-button" disabled={page.isDone} onClick={() => setCursor(page.continueCursor)}>Next page</button></div> : null}
    </section>
  </main>;
}
