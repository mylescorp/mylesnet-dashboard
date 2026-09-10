"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "@/app/lib/convex";
import {
  Building2,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type PlatformUser = NonNullable<ReturnType<typeof useQuery<typeof api.platform.getCurrentPlatformUser>>>;
type UserRow = NonNullable<ReturnType<typeof useQuery<typeof api.platformUsers.listUsers>>>[number];
type RoleRow = NonNullable<ReturnType<typeof useQuery<typeof api.rolesAdmin.listRoles>>>[number];
type InvitationRow = NonNullable<ReturnType<typeof useQuery<typeof api.invitations.listInvitations>>>[number];
type Market = NonNullable<ReturnType<typeof useQuery<typeof api.markets.listMarkets>>>[number];
type CatalogPermission =
  NonNullable<ReturnType<typeof useQuery<typeof api.rolesAdmin.getPermissionsCatalog>>>["permissions"][number];

type TabKey = "users" | "roles" | "invitations" | "organization";

const marketRoles = ["manager", "operator", "viewer"] as const;
type MarketRole = (typeof marketRoles)[number];

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function Modal({
  title,
  eyebrow,
  onClose,
  children,
  actions,
  fullScreen = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="profile-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`profile-modal-dialog${fullScreen ? " profile-modal-dialog-fullscreen" : ""}`}>
        <header className="profile-modal-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="page-title" style={{ margin: 0 }}>{title}</h2>
          </div>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <div className="profile-modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="pf-panel" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
      <Loader2 size={18} className="spinner" /> Loading access controls…
    </div>
  );
}

function EmptyPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="access-empty workspace-card">
      {icon}
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function Notice({ message, tone }: { message: string; tone: "ok" | "error" }) {
  return (
    <p className={`platform-claim-message ${tone === "ok" ? "ok" : ""}`} role="status">
      {message}
    </p>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

export default function AccessManagementPage() {
  const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});
  const [tab, setTab] = useState<TabKey>("users");

  if (currentUser === undefined) {
    return (
      <div className="workspace-page">
        <LoadingPanel />
      </div>
    );
  }
  if (currentUser == null || !currentUser.permissions.includes("users:manage")) {
    return (
      <div className="workspace-page">
        <div className="pf-panel">
          <h1 className="page-title">Access restricted</h1>
          <p className="page-subtitle">Only administrators can manage user access.</p>
        </div>
      </div>
    );
  }

  const canManageRoles = currentUser.permissions.includes("roles:manage");
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; available: boolean }[] = [
    { key: "users", label: "Users", icon: <UsersRound size={16} />, available: true },
    { key: "roles", label: "Roles", icon: <ShieldCheck size={16} />, available: canManageRoles },
    { key: "invitations", label: "Invitations", icon: <Mail size={16} />, available: true },
    { key: "organization", label: "Organization", icon: <Building2 size={16} />, available: true },
  ];

  return (
    <div className="workspace-page access-management-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">System administration</p>
          <h1 className="page-title">Access management</h1>
          <p className="page-subtitle">
            Manage who can reach the MylesNet Platform: accounts, roles, invitations and memberships.
            The role registry is Convex-authoritative and mirrored to WorkOS so sign-in tokens stay consistent.
          </p>
        </div>
      </header>

      <nav className="access-tabs" aria-label="Access management sections">
        {tabs
          .filter((entry) => entry.available)
          .map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`access-tab ${tab === entry.key ? "access-tab-active" : ""}`}
              onClick={() => setTab(entry.key)}
            >
              {entry.icon}
              <span>{entry.label}</span>
            </button>
          ))}
      </nav>

      {tab === "users" && <UsersTab currentUser={currentUser} />}
      {tab === "roles" && canManageRoles && <RolesTab />}
      {tab === "invitations" && <InvitationsTab />}
      {tab === "organization" && <OrganizationTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

function UsersTab({ currentUser }: { currentUser: PlatformUser }) {
  const users = useQuery(api.platformUsers.listUsers, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const rolesResult = useQuery(api.rolesAdmin.listRoles, {});
  const deleteUser = useAction(api.platformUsers.deleteUser);
  const restoreUser = useAction(api.platformUsers.restoreUser);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = useMemo(
    () => (rolesResult ?? []).filter((role) => role.slug !== "platform_owner"),
    [rolesResult],
  );
  const activeUsers = useMemo(() => (users ?? []).filter((user) => user.deletedAt === null), [users]);
  const removedUsers = useMemo(() => (users ?? []).filter((user) => user.deletedAt !== null), [users]);

  const matching = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeUsers.filter((user) => {
      const haystack = `${user.name ?? ""} ${user.email ?? ""} ${user.jobTitle ?? ""} ${user.phone ?? ""}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (roleFilter && !user.roles.some((role) => role.slug === roleFilter)) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
      return true;
    });
  }, [activeUsers, search, roleFilter, statusFilter]);

  if (users === undefined || markets === undefined || rolesResult === undefined) return <LoadingPanel />;

  const canRestore = currentUser.permissions.includes("trash:manage");

  const remove = async (user: UserRow) => {
    if (!confirm(`Remove ${user.email ?? "this account"}? Their sessions end immediately and access is revoked, but the account is kept and can be restored later.`)) return;
    setError(null);
    setNotice(null);
    try {
      await deleteUser({ userId: user._id });
      setNotice(`Account removed (soft-delete).`);
      if (editing?._id === user._id) setEditing(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not remove the account.");
    }
  };

  const restore = async (user: UserRow) => {
    setError(null);
    setNotice(null);
    try {
      await restoreUser({ userId: user._id });
      setNotice(`${user.email ?? "The account"} was restored. Reassign roles to grant access again.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not restore the account.");
    }
  };

  return (
    <>
      {notice ? <Notice message={notice} tone="ok" /> : null}
      {error ? <Notice message={error} tone="error" /> : null}

      <div className="access-toolbar">
        <label className="access-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search accounts</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, title or phone" />
        </label>
        <label className="access-filter">
          <span className="sr-only">Filter by role</span>
          <select className="pf-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {rolesResult.map((role) => (
              <option key={role._id} value={role.slug}>{role.name}</option>
            ))}
          </select>
        </label>
        <label className="access-filter">
          <span className="sr-only">Filter by status</span>
          <select className="pf-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="access-toolbar-spacer" />
        <span className="pf-muted">{matching.length} of {activeUsers.length} accounts</span>
        <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }}>
          <Plus size={16} aria-hidden="true" />Add user
        </button>
      </div>

      <section className="pf-panel">
        <div className="pf-table-wrap">
          <table className="pf-table access-users-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Roles</th>
                <th>Scope</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matching.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="pf-muted" style={{ padding: "20px 0", textAlign: "center" }}>
                      No accounts match the current filters.
                    </p>
                  </td>
                </tr>
              ) : (
                matching.map((user) => {
                  const membership = user.marketMemberships.find((item) => item.revokedAt === undefined);
                  const marketName = membership ? (markets ?? []).find((market) => market._id === membership.marketId)?.name : null;
                  const removable = user._id !== currentUser._id && user.primaryRole?.slug !== "platform_owner";
                  const initials = (user.name || user.email || "?").slice(0, 1).toUpperCase();
                  return (
                    <tr key={user._id}>
                      <td>
                        <div className="user-cell">
                          <span className="cell-avatar" aria-hidden="true">
                            {user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.image} alt="" width={36} height={36} className="avatar-img-sm" />
                            ) : initials}
                          </span>
                          <span className="cell-copy">
                            <strong>{user.name || "Unnamed account"}</strong>
                            <small>{user.email ?? "No email synchronized"}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="role-chip-list">
                          {user.roles.length === 0 ? (
                            <span className="pf-muted">—</span>
                          ) : (
                            <>
                              {user.roles.slice(0, 3).map((role) => (
                                <span key={role._id} className={`role-chip ${role.slug === user.primaryRole?.slug ? "role-chip-primary" : ""}`}>
                                  {role.name}
                                </span>
                              ))}
                              {user.roles.length > 3 ? (
                                <span className="role-chip role-chip-muted">+{user.roles.length - 3}</span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                      <td>{marketName ?? "All platform markets"}</td>
                      <td>
                        <span className={`status-pill ${user.isActive ? "status-pill-success" : "status-pill-danger"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="icon-button"
                            title="Edit account"
                            onClick={() => { setError(null); setNotice(null); setEditing(user); }}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          {removable && (
                            <button
                              type="button"
                              className="icon-button icon-button-danger"
                              title="Remove account"
                              onClick={() => void remove(user)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canRestore && removedUsers.length > 0 ? (
        <section className="workspace-card removed-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recently removed</p>
              <h2 className="page-subtitle">{removedUsers.length} account{removedUsers.length === 1 ? "" : "s"} kept for restore</h2>
            </div>
          </div>
          <div className="removed-list">
            {removedUsers.map((user) => (
              <div key={user._id} className="removed-row">
                <span className="cell-copy">
                  <strong>{user.email ?? "Unknown email"}</strong>
                  <small>Removed {new Date(user.deletedAt as number).toLocaleString()}</small>
                </span>
                <button type="button" className="secondary-button" onClick={() => void restore(user)}>
                  <RotateCcw size={14} aria-hidden="true" />Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {creating ? (
        <UserFormModal
          mode="create"
          currentUser={currentUser}
          markets={markets ?? []}
          roles={assignableRoles}
          onClose={() => setCreating(false)}
          onNotice={setNotice}
        />
      ) : null}
      {editing ? (
        <UserFormModal
          mode="edit"
          user={editing}
          currentUser={currentUser}
          markets={markets ?? []}
          roles={assignableRoles}
          onClose={() => setEditing(null)}
          onNotice={setNotice}
          onDelete={() => void remove(editing)}
        />
      ) : null}
    </>
  );
}

function UserFormModal({
  mode,
  user,
  currentUser,
  markets,
  roles,
  onClose,
  onNotice,
  onDelete,
}: {
  mode: "create" | "edit";
  user?: UserRow;
  currentUser: PlatformUser;
  markets: Market[];
  roles: RoleRow[];
  onClose: () => void;
  onNotice: (value: string) => void;
  onDelete?: () => void;
}) {
  const createUser = useAction(api.platformUsers.createUser);
  const setUserAccess = useAction(api.platformUsers.setUserAccess);

  const membership = user?.marketMemberships.find((item) => item.revokedAt === undefined);
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id<"roles">[]>(
    user ? user.roles.map((role) => role._id as Id<"roles">) : [],
  );
  const [marketId, setMarketId] = useState<string>(membership?.marketId ?? "");
  const [marketRole, setMarketRole] = useState<MarketRole>(membership?.role ?? "viewer");
  const [active, setActive] = useState(user ? user.isActive : true);
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleRole = (roleId: Id<"roles">) => {
    setSelectedRoleIds((current) => (current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId]));
  };

  const save = async () => {
    setWorking(true);
    setLocalError(null);
    try {
      const marketScope = marketId ? (marketId as Id<"markets">) : undefined;
      if (mode === "create") {
        if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
        await createUser({
          email,
          name: name.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          phone: phone.trim() || undefined,
          roleIds: selectedRoleIds,
          marketId: marketScope,
          marketRole: marketScope ? marketRole : undefined,
        });
        onNotice(`User ${email.trim().toLowerCase()} added to the directory.`);
      } else if (user) {
        await setUserAccess({
          userId: user._id,
          roleIds: selectedRoleIds,
          isActive: active,
          marketId: marketScope,
          marketRole: marketScope ? marketRole : undefined,
          name: name.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        onNotice(`Changes saved for ${user.email ?? "the account"}.`);
      }
      onClose();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "That action failed. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const canDelete = mode === "edit" && user != null && user._id !== currentUser._id && user.primaryRole?.slug !== "platform_owner";

  return (
    <Modal
      title={mode === "create" ? "Add a user" : "Edit account"}
      eyebrow="User directory"
      onClose={onClose}
      actions={
        <>
          {canDelete && user ? (
            <button
              type="button"
              className="secondary-button access-danger-button"
              onClick={() => {
                if (confirm(`Remove ${user.email ?? "this account"}? This is a soft delete — the account can be restored.`)) onDelete?.();
              }}
              disabled={working}
            >
              <Trash2 size={15} aria-hidden="true" />Remove account
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onClose} disabled={working}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={working}>
            {working ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </>
      }
    >
      {localError ? <Notice message={localError} tone="error" /> : null}

      <div className="form-grid">
        <label className="pf-field">
          <span className="pf-label">Email</span>
          <input
            type="email"
            className="pf-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={mode === "edit"}
            placeholder="name@example.com"
            maxLength={200}
          />
          {mode === "edit" ? <small className="pf-hint">WorkOS identity — not editable here.</small> : null}
        </label>
        <label className="pf-field">
          <span className="pf-label">Full name</span>
          <input className="pf-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Okafor" maxLength={120} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Job title</span>
          <input className="pf-input" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Field supervisor" maxLength={100} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Phone</span>
          <input className="pf-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+256712345678" maxLength={30} />
        </label>
      </div>

      <section className="modal-section">
        <p className="pf-label">Assigned roles</p>
        <p className="pf-hint">The highest-ranked role becomes the primary role and mirrors to the WorkOS membership.</p>
        <div className="access-role-checklist">
          {roles.length === 0 ? (
            <p className="pf-muted">No assignable roles yet — create a role in the Roles tab first.</p>
          ) : (
            roles.map((role) => (
              <label key={role._id} className="access-role-check">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role._id as Id<"roles">)}
                  onChange={() => toggleRole(role._id as Id<"roles">)}
                />
                <span>{role.name}</span>
                {role.isPlatform ? <em>platform</em> : null}
              </label>
            ))
          )}
        </div>
      </section>

      <div className="form-grid">
        <label className="pf-field">
          <span className="pf-label">Market scope</span>
          <select className="pf-input" value={marketId} onChange={(event) => setMarketId(event.target.value)}>
            <option value="">All platform markets</option>
            {markets.map((market) => (
              <option key={market._id} value={market._id}>{market.name}</option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span className="pf-label">Scope role</span>
          <select className="pf-input" value={marketRole} disabled={!marketId} onChange={(event) => setMarketRole(event.target.value as MarketRole)}>
            {marketRoles.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {mode === "edit" && user ? (
        <label className="modal-section access-status-toggle access-status-toggle-block">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>Account active — deactivating ends sessions and blocks sign-in.</span>
        </label>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

function RolesTab() {
  const roles = useQuery(api.rolesAdmin.listRoles, {});
  const catalog = useQuery(api.rolesAdmin.getPermissionsCatalog, {});
  const deleteRole = useAction(api.rolesAdmin.deleteRole);
  const ensureRoles = useAction(api.rolesAdmin.ensureRoles);

  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(
    () => (roles ?? []).filter((role) => `${role.name} ${role.slug} ${role.description ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase())),
    [roles, filter],
  );

  if (roles === undefined || catalog === undefined) return <LoadingPanel />;

  const syncNow = async () => {
    setWorking(true);
    setNotice(null);
    setError(null);
    try {
      await ensureRoles();
      setNotice("System roles and user backfill are up to date.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sync failed. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const remove = async (role: RoleRow) => {
    if (!confirm(`Delete the "${role.name}" role? Users must be reassigned first.`)) return;
    setWorking(true);
    setNotice(null);
    setError(null);
    try {
      await deleteRole({ roleId: role._id });
      setNotice(`Role "${role.name}" deleted.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete the role.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      {notice ? <Notice message={notice} tone="ok" /> : null}
      {error ? <Notice message={error} tone="error" /> : null}

      <div className="access-toolbar">
        <label className="access-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Filter roles</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter roles…" />
        </label>
        <div className="access-toolbar-spacer" />
        <span className="pf-muted">{roles.length} roles · {roles.filter((role) => !role.isSystem).length} custom</span>
        <button type="button" className="secondary-button" onClick={() => void syncNow()} disabled={working}>
          <RefreshCw size={15} aria-hidden="true" />Sync with WorkOS
        </button>
        <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }} disabled={working}>
          <Plus size={16} aria-hidden="true" />New role
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyPanel icon={<ShieldCheck size={24} />} title="No roles match" body="Try a different filter, or create a custom role." />
      ) : (
        <section className="role-grid">
          {filtered.map((role) => (
            <article key={role._id} className="role-card">
              <header className="role-card-head">
                <div className="cell-copy">
                  <strong>{role.name}</strong>
                  <small>{role.slug}</small>
                </div>
                <div className="role-card-badges">
                  {role.isSystem ? <span className="role-badge role-badge-system">System</span> : <span className="role-badge">Custom</span>}
                  {role.isPlatform ? <span className="role-badge role-badge-platform">Platform</span> : null}
                </div>
              </header>
              <p className="role-card-desc">{role.description ?? (role.isSystem ? "Part of the built-in role set." : "No description.")}</p>
              <dl className="role-card-meta">
                <div><dt>Permissions</dt><dd>{role.permissions.length}</dd></div>
                <div><dt>Assigned</dt><dd>{role.assignedCount}</dd></div>
                <div><dt>Rank</dt><dd>{role.rank}</dd></div>
                <div>
                  <dt>WorkOS</dt>
                  <dd className={role.syncedToWorkos ? "role-sync-ok" : "role-sync-off"}>{role.syncedToWorkos ? "Synced" : "Local only"}</dd>
                </div>
              </dl>
              <footer className="role-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { setError(null); setNotice(null); setEditingRole(role); }}
                  disabled={working}
                >
                  <Pencil size={14} aria-hidden="true" />{role.isSystem ? "View & edit" : "Edit"}
                </button>
                {!role.isSystem && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void remove(role)}
                    disabled={working || role.assignedCount > 0}
                    title={role.assignedCount > 0 ? "Reassign users before deleting" : "Delete role"}
                  >
                    <Trash2 size={14} aria-hidden="true" />Delete
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
      )}

      {creating ? (
        <RoleEditorModal
          catalogPermissions={catalog.permissions}
          onClose={() => setCreating(false)}
          onNotice={setNotice}
        />
      ) : null}
      {editingRole ? (
        <RoleEditorModal
          role={editingRole}
          catalogPermissions={catalog.permissions}
          onClose={() => setEditingRole(null)}
          onNotice={setNotice}
        />
      ) : null}
    </>
  );
}

function RoleEditorModal({
  role,
  catalogPermissions,
  onClose,
  onNotice,
}: {
  role?: RoleRow;
  catalogPermissions: readonly CatalogPermission[];
  onClose: () => void;
  onNotice: (value: string) => void;
}) {
  const createRole = useAction(api.rolesAdmin.createRole);
  const updateRole = useAction(api.rolesAdmin.updateRole);

  const [name, setName] = useState(role?.name ?? "");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [permissionFilter, setPermissionFilter] = useState("");
  const [activeGroup, setActiveGroup] = useState("All permissions");
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const query = permissionFilter.trim().toLowerCase();
    const map = new Map<string, CatalogPermission[]>();
    for (const permission of catalogPermissions) {
      if (activeGroup !== "All permissions" && permission.group !== activeGroup) continue;
      if (query && !`${permission.name} ${permission.slug}`.toLowerCase().includes(query)) continue;
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return Array.from(map.entries());
  }, [activeGroup, catalogPermissions, permissionFilter]);

  const togglePermission = (item: string) => {
    setPermissions((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const toggleGroup = (items: readonly CatalogPermission[]) => {
    const slugs = items.map((item) => item.slug);
    const everySelected = slugs.every((slug) => permissions.includes(slug));
    setPermissions((current) => everySelected
      ? current.filter((slug) => !slugs.includes(slug as CatalogPermission["slug"]))
      : Array.from(new Set([...current, ...slugs])));
  };

  const catalogGroups = useMemo(
    () => Array.from(new Set(catalogPermissions.map((permission) => permission.group))),
    [catalogPermissions],
  );

  const save = async () => {
    setWorking(true);
    setLocalError(null);
    try {
      if (role) {
        await updateRole({ roleId: role._id, name, description: description.trim() || undefined, permissions });
        onNotice(`Role "${name}" updated.`);
      } else {
        if (!slug.trim()) throw new Error("A slug is required for new roles.");
        await createRole({ name, slug, description: description.trim() || undefined, permissions });
        onNotice(`Role "${name}" created.`);
      }
      onClose();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "That action failed. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      title={role ? `Edit ${role.name}` : "Create a custom role"}
      eyebrow="Role editor"
      onClose={onClose}
      fullScreen={!!role}
      actions={
        <>
          <button type="button" className="secondary-button" onClick={onClose} disabled={working}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={working}>
            {working ? "Saving…" : role ? "Save role" : "Create role"}
          </button>
        </>
      }
    >
      {localError ? <Notice message={localError} tone="error" /> : null}

      <div className="role-editor-workspace">
        <aside className="role-editor-sidebar" aria-label="Role configuration">
          <div className="role-editor-summary">
            <span className="role-editor-kicker">Access profile</span>
            <strong>{role?.isSystem ? "System role" : role ? "Custom role" : "New role"}</strong>
            <p>{role?.isSystem ? "Identity and rank are protected. You can tailor access grants safely." : "Define exactly what this role can view and manage."}</p>
          </div>
          <div className="role-editor-stat"><strong>{permissions.length}</strong><span>permissions selected</span></div>
          <nav className="role-group-nav" aria-label="Permission categories">
            <button type="button" className={activeGroup === "All permissions" ? "role-group-nav-active" : ""} onClick={() => setActiveGroup("All permissions")}>
              <span>All permissions</span><b>{catalogPermissions.length}</b>
            </button>
            {catalogGroups.map((group) => {
              const total = catalogPermissions.filter((permission) => permission.group === group);
              const selected = total.filter((permission) => permissions.includes(permission.slug)).length;
              return <button key={group} type="button" className={activeGroup === group ? "role-group-nav-active" : ""} onClick={() => setActiveGroup(group)}><span>{group}</span><b>{selected}/{total.length}</b></button>;
            })}
          </nav>
        </aside>

        <div className="role-editor-content">
          <div className="role-editor-details form-grid">
            <label className="pf-field">
              <span className="pf-label">Role name</span>
              <input className="pf-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Field supervisor" maxLength={60} />
            </label>
            {!role ? (
              <label className="pf-field">
                <span className="pf-label">Role slug</span>
                <input className="pf-input" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="field-supervisor" maxLength={50} />
                <small className="pf-hint">Lowercase letters, digits, hyphens and underscores.</small>
              </label>
            ) : (
              <div className="role-identity-field"><span className="pf-label">Protected identity</span><code>{role.slug} · rank {role.rank}</code></div>
            )}
            <label className="pf-field" style={{ gridColumn: "1 / -1" }}>
              <span className="pf-label">Description</span>
              <input className="pf-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder="What this role is for" />
            </label>
          </div>

          <section className="role-permissions-panel" aria-label="Role permissions">
            <header className="role-permissions-toolbar">
              <div><p className="pf-label">{activeGroup}</p><p className="pf-hint">Choose the capabilities this role should have. Changes take effect immediately after saving.</p></div>
              <label className="access-search">
                <Search size={15} aria-hidden="true" /><span className="sr-only">Filter permissions</span>
                <input value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} placeholder="Search permissions…" />
              </label>
            </header>
            <div className="perm-groups">
              {groups.map(([group, items]) => {
                const everySelected = items.every((permission) => permissions.includes(permission.slug));
                return (
                  <div key={group} className="perm-group">
                    <header className="perm-group-heading"><div><p className="perm-group-title">{group}</p><span>{items.filter((permission) => permissions.includes(permission.slug)).length} of {items.length} enabled</span></div><button type="button" className="permission-bulk-button" onClick={() => toggleGroup(items)}>{everySelected ? "Clear group" : "Enable group"}</button></header>
                    <div className="role-permission-grid">
                      {items.map((permission) => (
                        <label key={permission.slug} className={`role-permission-option${permissions.includes(permission.slug) ? " role-permission-option-selected" : ""}`}>
                          <input type="checkbox" checked={permissions.includes(permission.slug)} onChange={() => togglePermission(permission.slug)} />
                          <span><strong>{permission.name}</strong><small>{permission.slug}</small></span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {groups.length === 0 ? <p className="pf-muted">No permissions match this search.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

function InvitationsTab() {
  const invitations = useQuery(api.invitations.listInvitations, {});
  const rolesResult = useQuery(api.rolesAdmin.listRoles, {});
  const sendInvitation = useAction(api.invitations.sendInvitation);
  const revokeInvitation = useAction(api.invitations.revokeInvitation);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<Id<"roles"> | "">("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [sending, setSending] = useState(false);

  if (invitations === undefined || rolesResult === undefined) return <LoadingPanel />;

  const invitableRoles = rolesResult.filter((role) => role.slug !== "platform_owner" && role.workosRoleSlug);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setNotice(null);
    setError(null);
    try {
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      if (!roleId) throw new Error("Choose a role for the invitee.");
      await sendInvitation({ email, roleId, expiresInDays: Number(expiresInDays) || 7 });
      setNotice(`Invitation sent to ${email.trim().toLowerCase()}.`);
      setEmail("");
      setRoleId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send the invitation.");
    } finally {
      setSending(false);
    }
  };

  const revoke = async (invitation: InvitationRow) => {
    if (!confirm(`Revoke the invitation to ${invitation.email}?`)) return;
    setNotice(null);
    setError(null);
    try {
      await revokeInvitation({ invitationId: invitation._id });
      setNotice(`Invitation to ${invitation.email} revoked.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not revoke the invitation.");
    }
  };

  const statusTone = (status: string) => (status === "accepted" ? "success" : status === "revoked" ? "danger" : "warning");

  return (
    <>
      {notice ? <Notice message={notice} tone="ok" /> : null}
      {error ? <Notice message={error} tone="error" /> : null}

      <form className="workspace-card invite-form" onSubmit={send}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Invite a teammate</p>
            <p className="pf-hint">Acceptance auto-joins the account to the MylesNet Platform organization with the chosen role.</p>
          </div>
        </div>
        <div className="invite-fields">
          <label className="pf-field">
            <span className="pf-label">Email</span>
            <input type="email" className="pf-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" />
          </label>
          <label className="pf-field">
            <span className="pf-label">Role</span>
            <select className="pf-input" value={roleId} onChange={(event) => setRoleId(event.target.value as Id<"roles"> | "")}>
              <option value="">Choose role…</option>
              {invitableRoles.map((role) => (
                <option key={role._id} value={role._id}>{role.name}</option>
              ))}
            </select>
          </label>
          <label className="pf-field">
            <span className="pf-label">Expires in (days)</span>
            <input type="number" className="pf-input" min={1} max={30} value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} />
          </label>
          <button type="submit" className="primary-button" disabled={sending} style={{ alignSelf: "end" }}>
            {sending ? "Sending…" : <><KeyRound size={16} aria-hidden="true" />Send invitation</>}
          </button>
        </div>
      </form>

      <section className="pf-panel">
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="pf-hide-sm">Sent</th>
                <th className="pf-hide-sm">Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr><td colSpan={6}><p className="pf-muted" style={{ padding: "20px 0", textAlign: "center" }}>No invitations recorded yet.</p></td></tr>
              ) : (
                invitations.map((invitation) => (
                  <tr key={invitation._id}>
                    <td>{invitation.email}</td>
                    <td>{invitation.roleName ?? invitation.roleSlug ?? "—"}</td>
                    <td><span className={`status-pill status-pill-${statusTone(invitation.status)}`}>{invitation.status}</span></td>
                    <td className="pf-hide-sm">{invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="pf-hide-sm">{invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : "—"}</td>
                    <td>
                      {invitation.status === "pending" ? (
                        <button type="button" className="secondary-button" onClick={() => void revoke(invitation)}>Revoke</button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Organization                                                        */
/* ------------------------------------------------------------------ */

function OrganizationTab() {
  const overview = useQuery(api.organizations.getOrganizationOverview, {});
  if (overview === undefined) return <LoadingPanel />;
  if (!overview) {
    return (
      <EmptyPanel
        icon={<Building2 size={24} />}
        title="Organization not configured"
        body="Set MYLESNET_PLATFORM_ORG_ID so the platform organization can be shown."
      />
    );
  }

  const membershipHealth = overview.pendingMemberships + overview.inactiveMemberships === 0 ? "Healthy" : "Needs review";
  const largestRoleCount = Math.max(...overview.roleDistribution.map((entry) => entry.count), 1);

  return (
    <div className="organization-overview">
      <section className="organization-hero workspace-card">
        <div className="organization-hero-mark"><Building2 aria-hidden="true" size={24} /></div>
        <div className="organization-hero-copy"><p className="eyebrow">Platform organization</p><h2>{overview.displayName}</h2><p>Central access profile for memberships, roles, and secure sign-in governance.</p><code title={overview.organizationId}>{overview.organizationId}</code></div>
        <div className={`organization-health organization-health-${membershipHealth === "Healthy" ? "ok" : "review"}`}><span></span><div><strong>{membershipHealth}</strong><small>{membershipHealth === "Healthy" ? "No pending or inactive memberships" : "Pending or inactive memberships need attention"}</small></div></div>
      </section>

      <section className="organization-stat-grid" aria-label="Organization membership summary">
        <article className="organization-stat workspace-card"><span className="organization-stat-icon"><UsersRound aria-hidden="true" size={18} /></span><p>Active members</p><strong>{overview.activeMemberships}</strong><small>of {overview.totalMemberships} total memberships</small></article>
        <article className="organization-stat workspace-card"><span className="organization-stat-icon"><ShieldCheck aria-hidden="true" size={18} /></span><p>Access review</p><strong>{overview.pendingMemberships + overview.inactiveMemberships}</strong><small>{overview.pendingMemberships} pending · {overview.inactiveMemberships} inactive</small></article>
        <article className="organization-stat workspace-card"><span className="organization-stat-icon"><KeyRound aria-hidden="true" size={18} /></span><p>Your access</p><strong>{overview.currentUserRoles.length}</strong><small>{overview.currentUserRoles.map((role) => role.name).join(", ") || "No role assigned"}</small></article>
      </section>

      <section className="organization-distribution workspace-card">
        <header className="organization-distribution-head"><div><p className="eyebrow">Access coverage</p><h2>Role distribution</h2><p>Where platform responsibility is currently assigned.</p></div><span className="organization-distribution-total">{overview.totalMemberships} memberships</span></header>
        {overview.roleDistribution.length === 0 ? <p className="pf-muted">No memberships recorded yet.</p> : (
          <div className="organization-role-list">
            {overview.roleDistribution.map((entry) => {
              const share = Math.round((entry.count / largestRoleCount) * 100);
              return <article key={entry.slug} className="organization-role-row"><div className="organization-role-copy"><strong>{entry.name}</strong><code>{entry.slug}</code></div><div className="organization-role-meter" aria-label={`${entry.count} members assigned`}><span style={{ width: `${share}%` }} /></div><div className="organization-role-count"><strong>{entry.count}</strong><span>member{entry.count === 1 ? "" : "s"}</span></div></article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
