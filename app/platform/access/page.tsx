"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { Check, Search, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const platformRoles = ["platform_owner", "platform_admin", "platform_support", "agent"] as const;
const marketRoles = ["manager", "operator", "viewer"] as const;
type PlatformRole = (typeof platformRoles)[number];
type MarketRole = (typeof marketRoles)[number];
type UserRow = NonNullable<ReturnType<typeof useQuery<typeof api.platformUsers.listUsers>>>[number];
type Market = NonNullable<ReturnType<typeof useQuery<typeof api.markets.listMarkets>>>[number];

function displayRole(role: string | null | undefined) {
  return role ? role.replace("platform_", "").replace("_", " ") : "Unassigned";
}

function AccessCard({ user, markets, onSaved }: { user: UserRow; markets: Market[]; onSaved: (value: string) => void }) {
  const saveAccess = useMutation(api.platformUsers.setUserAccess);
  const membership = user.marketMemberships.find((item) => item.revokedAt === undefined);
  const [role, setRole] = useState<PlatformRole>(user.platformRole && platformRoles.includes(user.platformRole as PlatformRole) ? user.platformRole as PlatformRole : "agent");
  const [active, setActive] = useState(user.isActive);
  const [marketId, setMarketId] = useState<string>(membership?.marketId ?? "");
  const [marketRole, setMarketRole] = useState<MarketRole>(membership?.role ?? "viewer");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveAccess({ userId: user._id, platformRole: role, isActive: active, marketId: marketId ? marketId as Id<"markets"> : undefined, marketRole: marketId ? marketRole : undefined });
      onSaved("Access settings saved.");
    } catch {
      onSaved("We could not update access settings. Please try again.");
    } finally { setSaving(false); }
  };
  const initials = (user.name || user.email || "?").slice(0, 1).toUpperCase();
  return <article className="access-card">
    <header className="access-card-header">
      <div className="access-avatar" aria-hidden="true">{user.image ? <Image src={user.image} alt="" width={42} height={42} unoptimized /> : initials}</div>
      <div className="access-identity"><h2>{user.name || "Unnamed account"}</h2><p>{user.email || "No email synchronized"}</p></div>
      <span className={`status-pill ${active ? "status-pill-success" : "status-pill-danger"}`}>{active ? "Active" : "Inactive"}</span>
    </header>
    <div className="access-fields">
      <label className="pf-field"><span className="pf-label">Platform role</span><select className="pf-input" value={role} onChange={(event) => setRole(event.target.value as PlatformRole)}>{platformRoles.map((item) => <option key={item} value={item}>{displayRole(item)}</option>)}</select></label>
      <label className="pf-field"><span className="pf-label">Market scope</span><select className="pf-input" value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="">All platform markets</option>{markets.map((market) => <option key={market._id} value={market._id}>{market.name}</option>)}</select></label>
      <label className="pf-field"><span className="pf-label">Scope role</span><select className="pf-input" value={marketRole} disabled={!marketId} onChange={(event) => setMarketRole(event.target.value as MarketRole)}>{marketRoles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    <footer className="access-card-footer">
      <label className="access-status-toggle"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>Account active</span></label>
      <button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : <><Check size={16} aria-hidden="true" />Save changes</>}</button>
    </footer>
  </article>;
}

export default function AccessManagementPage() {
  const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});
  const isOwner = currentUser?.platformRole === "platform_owner";
  const users = useQuery(api.platformUsers.listUsers, isOwner ? {} : "skip");
  const markets = useQuery(api.markets.listMarkets, isOwner ? {} : "skip");
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const matchingUsers = useMemo(() => (users ?? []).filter((user) => `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [search, users]);
  if (currentUser === undefined) return <div className="platform-page"><p className="page-subtitle">Loading access controls…</p></div>;
  if (!isOwner) return <div className="platform-page"><div className="pf-panel"><h1 className="page-title">Access restricted</h1><p className="page-subtitle">Only the platform owner can manage user roles and market access.</p></div></div>;
  if (users === undefined || markets === undefined) return <div className="platform-page"><p className="page-subtitle">Loading access controls…</p></div>;
  return <div className="workspace-page access-management-page">
    <header className="page-heading"><div><p className="eyebrow">System administration</p><h1 className="page-title">Access management</h1><p className="page-subtitle">Set each team member&apos;s platform role, account status, and market scope from one authoritative control surface.</p></div><div className="access-summary"><UsersRound size={18} aria-hidden="true" /><strong>{users.length}</strong><span>managed accounts</span></div></header>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}
    <section className="access-toolbar workspace-card" aria-label="Directory controls"><div className="access-toolbar-copy"><ShieldCheck size={20} aria-hidden="true" /><div><strong>Role directory</strong><span>Changes take effect for the user&apos;s next protected action.</span></div></div><label className="access-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search accounts</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" /></label></section>
    {matchingUsers.length === 0 ? <section className="access-empty workspace-card"><UserRound size={24} aria-hidden="true" /><h2>No matching accounts</h2><p>Try a different name or email address.</p></section> : <section className="access-card-grid" aria-label="Managed accounts">{matchingUsers.map((user) => <AccessCard key={user._id} user={user} markets={markets} onSaved={setMessage} />)}</section>}
  </div>;
}
