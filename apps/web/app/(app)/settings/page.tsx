"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, Settings2, Wallet, Boxes, Mail, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import MetricCard from "@/app/components/MetricCard";
import { ErrorNote, Loading } from "@/app/components/ui";
import { useUserProfile } from "@/app/components/UserProfileContext";

export default function SettingsPage() {
  const environment = process.env.NEXT_PUBLIC_CONVEX_URL || "local";
  const isProd = environment.includes("convex.cloud");
  const settings = useQuery(api.systemSettings.getSystemSettingsView, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const setHealthguard = useMutation(api.systemSettings.setHealthguardEnabled);
  const { user } = useUserProfile();
  const canManage = user?.permissions?.includes("collector:manage") === true;
  const [error, setError] = useState<string | null>(null);
  if (settings === undefined || markets === undefined) return <Loading />;
  const rows = [{ key: "Environment", value: isProd ? "Production" : "Local development" }, { key: "Convex backend", value: environment }, { key: "Deployment", value: isProd ? "Cloud" : "Local dev server" }, { key: "Currency model", value: "Multi-currency (UGX / KSH / USD) with nightly FX sync" }, { key: "Alert stack", value: "Threshold-driven alerts with SMS + email escalation" }];
  return <div className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Administration</p><h1 className="page-title">Settings</h1><p className="page-subtitle">Live platform configuration and operational controls.</p></div></div><div className="metric-grid"><MetricCard icon={Globe} label="Environment" value={isProd ? "Production" : "Local"} tone={isProd ? "success" : "warning"} detail={environment} /><MetricCard icon={Settings2} label="Markets" value={markets.length} tone="neutral" detail="Configured markets" /><MetricCard icon={Wallet} label="Currency" value="UGX / KSH / USD" tone="accent" detail="Multi-currency" /></div><div className="section-block"><div className="section-heading"><div><p className="eyebrow">Platform</p><h2>Runtime configuration</h2></div></div><div className="pf-panel"><div className="pf-table-wrap"><table className="pf-table"><tbody>{rows.map((row) => <tr key={row.key}><td style={{ width: "35%" }}><strong>{row.key}</strong></td><td className="pf-muted">{row.value}</td></tr>)}</tbody></table></div></div></div><div className="section-block"><div className="section-heading"><div><p className="eyebrow">Collector safety</p><h2>HealthGuard kill switch</h2></div></div><div className="pf-panel"><div className="flex items-center justify-between gap-4"><div><strong>Self-healing HTTPS restoration</strong><p className="pf-muted" style={{ margin: "4px 0 0" }}>Controls whether the collector may restore the approved RouterOS HTTPS service.</p></div><button disabled={!canManage} className="pf-button pf-button-primary" onClick={async () => { setError(null); try { await setHealthguard({ enabled: !settings.healthguardEnabled }); } catch (err) { setError(err instanceof Error ? err.message : "Could not update HealthGuard"); } }}>{settings.healthguardEnabled ? "Disable" : "Enable"}</button></div><p className="pf-hint" style={{ display: "block", marginTop: 12 }}>Current state: <strong>{settings.healthguardEnabled ? "enabled" : "disabled"}</strong>{!canManage && " — collector:manage permission required to change it."}</p>{error && <ErrorNote>{error}</ErrorNote>}</div></div><div className="section-block"><div className="section-heading"><div><p className="eyebrow">Shortcuts</p><h2>Related surfaces</h2></div></div><div className="pf-panel">{[{ href: "/integrations", icon: Mail, label: "Integrations", detail: "Server-backed provider status" }, { href: "/site-kit", icon: Boxes, label: "Site kit", detail: "Approved device standards" }, { href: "/access", icon: ShieldCheck, label: "Roles & permissions", detail: "Who can do what" }].map((item) => <Link key={item.href} href={item.href} className="pf-shortcut" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 4px", borderBottom: "1px solid var(--line)" }}><span className="metric-icon" style={{ background: "var(--surface-strong)", color: "var(--accent)" }}><item.icon size={18} /></span><span style={{ flex: 1 }}><strong style={{ display: "block" }}>{item.label}</strong><small className="pf-muted">{item.detail}</small></span><span className="pf-muted">→</span></Link>)}</div></div></div>;
}
