"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const platformRoles = ["platform_owner", "platform_admin", "platform_support", "agent"] as const;
const marketRoles = ["manager", "operator", "viewer"] as const;
type PlatformRole = (typeof platformRoles)[number];
type MarketRole = (typeof marketRoles)[number];
type UserRow = NonNullable<ReturnType<typeof useQuery<typeof api.platformUsers.listUsers>>>[number];
type Market = NonNullable<ReturnType<typeof useQuery<typeof api.markets.listMarkets>>>[number];

function AccessRow({ user, markets, onSaved }: { user: UserRow; markets: Market[]; onSaved: (value: string) => void }) {
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
  return <tr>
    <td><strong>{user.name || user.email || "Unnamed account"}</strong><br /><small>{user.email || "No email synchronized"}</small></td>
    <td><select value={role} onChange={(event) => setRole(event.target.value as PlatformRole)}>{platformRoles.map((item) => <option key={item} value={item}>{item.replace("platform_", "").replace("_", " ")}</option>)}</select></td>
    <td><label><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label></td>
    <td><select value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="">No market scope</option>{markets.map((market) => <option key={market._id} value={market._id}>{market.name}</option>)}</select></td>
    <td><select value={marketRole} disabled={!marketId} onChange={(event) => setMarketRole(event.target.value as MarketRole)}>{marketRoles.map((item) => <option key={item} value={item}>{item}</option>)}</select></td>
    <td><button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button></td>
  </tr>;
}

export default function AccessManagementPage() {
  const users = useQuery(api.platformUsers.listUsers, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const [message, setMessage] = useState<string | null>(null);
  if (users === undefined || markets === undefined) return <div className="platform-page"><p className="page-subtitle">Loading access controls…</p></div>;
  return <div className="platform-page">
    <div className="platform-page-header"><div><p className="eyebrow">System administration</p><h1 className="page-title">Access management</h1><p className="page-subtitle">Assign platform roles, account status, and market scopes from one authoritative control surface.</p></div></div>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}
    <div className="pf-panel" style={{ overflowX: "auto" }}><table className="pf-table"><thead><tr><th>User</th><th>Platform role</th><th>Account</th><th>Market scope</th><th>Scope role</th><th>Action</th></tr></thead><tbody>{users.map((user) => <AccessRow key={user._id} user={user} markets={markets} onSaved={setMessage} />)}</tbody></table></div>
  </div>;
}
