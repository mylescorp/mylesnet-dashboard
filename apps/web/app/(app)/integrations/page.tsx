"use client";

import { Database, ExternalLink, Mail, MessageSquare, Settings2, Smartphone } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Loading, StatusPill } from "@/app/components/ui";

const definitions = [
  ["Africa's Talking", "SMS", MessageSquare, "sms", "Transaction and alert SMS."],
  ["Resend", "Email", Mail, "email", "Digest and scheduled-report email."],
  ["Centipid", "Billing", Database, "centipid", "Subscriber, payment and package data."],
  ["M-Pesa / Airtel Money", "Mobile money", Smartphone, "mobileMoney", "Payout and payment reconciliation."],
  ["RouterOS API", "Network", Settings2, "routerOs", "Telemetry and configuration monitoring."],
] as const;

export default function IntegrationsPage() {
  const status = useQuery(api.integrations.getIntegrationStatus, {});
  if (status === undefined) return <Loading />;
  return <div className="workspace-page"><div className="page-heading"><div><p className="eyebrow">Administration</p><h1 className="page-title">Integrations</h1><p className="page-subtitle">Server-backed readiness status. Secrets are configured outside the client and are never displayed.</p></div></div><div className="section-block"><div className="section-heading"><div><p className="eyebrow">Connections</p><h2>Integration posture</h2></div></div><div className="pf-panel">{definitions.map(([name, kind, Icon, key, description]) => { const value = status[key] as { configured?: boolean; configuredRouters?: number; totalRouters?: number; lastSyncAt?: number | null }; const configured = key === "routerOs" ? (value.configuredRouters ?? 0) > 0 : value.configured === true; return <div key={name} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid var(--line)" }}><span className="metric-icon" style={{ background: "var(--surface-strong)", color: "var(--accent)" }}><Icon size={19} /></span><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "flex", alignItems: "center", gap: 8 }}>{name}<StatusPill tone={configured ? "success" : "warning"}>{configured ? "configured" : "not configured"}</StatusPill></strong><p className="pf-muted" style={{ margin: "4px 0 0" }}>{description}</p>{key === "routerOs" && <small className="pf-muted">{value.configuredRouters ?? 0} of {value.totalRouters ?? 0} routers have encrypted collector credentials.</small>}{key === "centipid" && value.lastSyncAt && <small className="pf-muted">Last sync attempt: {new Date(value.lastSyncAt).toLocaleString()}</small>}</div><span className="pf-muted" style={{ fontSize: 12, fontWeight: 700 }}>{kind}</span></div>; })}</div></div><div className="section-block"><div className="section-heading"><div><p className="eyebrow">Setup</p><h2>Configuration boundary</h2></div></div><div className="pf-panel"><ul className="pf-muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}><li>SMS and email credentials are environment-managed.</li><li>RouterOS credentials are encrypted and managed per router.</li><li>Centipid credentials are encrypted and managed from Centipid Sync.</li><li><ExternalLink size={13} style={{ verticalAlign: -2 }} /> Provider contract and signed-delivery verification remain operational checks.</li></ul></div></div></div>;
}
