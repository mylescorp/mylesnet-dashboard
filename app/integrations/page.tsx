"use client";

import { ExternalLink, Mail, MessageSquare, Smartphone, Database, Settings2 } from "lucide-react";
import { StatusPill } from "@/app/components/ui";

const INTEGRATIONS = [
  {
    name: "Africa's Talking",
    kind: "SMS",
    icon: MessageSquare,
    description: "Transaction and alert SMS for subscribers and agents.",
    status: "available",
    accent: "primary",
  },
  {
    name: "Resend",
    kind: "Email",
    icon: Mail,
    description: "Digest emails, scheduled reports and investor letters.",
    status: "available",
    accent: "primary",
  },
  {
    name: "Centipid",
    kind: "Billing",
    icon: Database,
    description: "Subscriber, payment and package data for the connected market.",
    status: "connected",
    accent: "success",
  },
  {
    name: "M-Pesa / Airtel Money",
    kind: "Mobile Money",
    icon: Smartphone,
    description: "Payouts and payment reconciliation via provider APIs.",
    status: "planned",
    accent: "neutral",
  },
  {
    name: "RouterOS API",
    kind: "Network",
    icon: Settings2,
    description: "Telemetry, config audit and session control for managed routers.",
    status: "connected",
    accent: "success",
  },
];

const toneFor: Record<string, "success" | "warning" | "neutral"> = {
  connected: "success",
  available: "neutral",
  planned: "warning",
};

export default function IntegrationsPage() {
  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Integrations</h1>
          <p className="page-subtitle">The services that power the NOC — connectivity status and how they are used.</p>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Connections</p><h2>Integrations</h2></div>
        </div>
        <div className="pf-panel">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <div key={integration.name} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="metric-icon" style={{ background: "var(--surface-strong)", color: "var(--accent)" }}>
                  <Icon size={19} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {integration.name}
                    <StatusPill tone={toneFor[integration.status]}>{integration.status}</StatusPill>
                  </strong>
                  <p className="pf-muted" style={{ margin: "4px 0 0" }}>{integration.description}</p>
                </div>
                <span className="pf-muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{integration.kind}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Setup</p><h2>Where to configure</h2></div>
        </div>
        <div className="pf-panel">
          <ul className="pf-muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Set <b>AFRICAS_TALKING_USERNAME / API_KEY</b>, <b>RESEND_API_KEY</b> and <b>RESEND_FROM</b> in environment configuration.</li>
            <li>Managed routers connect through RouterOS credentials set on the router pages.</li>
            <li><ExternalLink size={13} style={{ verticalAlign: -2 }} /> More in the NOC spec integrations chapter.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}