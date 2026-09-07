"use client";

import Link from "next/link";
import { Globe, Settings2, Wallet, Boxes, Mail } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";

export default function SettingsPage() {
  const environment = process.env.NEXT_PUBLIC_CONVEX_URL || "local";
  const isProd = environment.includes("convex.cloud");

  const rows: { key: string; value: string }[] = [
    { key: "Environment", value: isProd ? "Production" : "Local development" },
    { key: "Convex backend", value: environment },
    { key: "Deployment", value: isProd ? "Cloud" : "Local dev server (port 3210)" },
    { key: "Currency model", value: "Multi-currency (UGX / KSH / USD) with nightly FX sync" },
    { key: "Alert stack", value: "Threshold-driven alerts with SMS + email escalation" },
  ];

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Platform overview and pointers to the configuration surfaces that matter.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Globe} label="Environment" value={isProd ? "Production" : "Local"} tone={isProd ? "success" : "warning"} detail={environment} />
        <MetricCard icon={Settings2} label="Markets" value="—" tone="neutral" detail="Configured markets" />
        <MetricCard icon={Wallet} label="Currency" value="UGX / KSH / USD" tone="accent" detail="Multi-currency" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Platform</p><h2>Settings</h2></div>
        </div>
        <div className="pf-panel">
          <div className="pf-table-wrap">
            <table className="pf-table">
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td style={{ width: "35%" }}><strong>{row.key}</strong></td>
                    <td className="pf-muted">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Shortcuts</p><h2>Related surfaces</h2></div>
        </div>
        <div className="pf-panel">
          {[
            { href: "/integrations", icon: Mail, label: "Integrations", detail: "SMS, email and billing connections" },
            { href: "/currency", icon: Wallet, label: "Currency", detail: "FX rates used in conversions" },
            { href: "/site-kit", icon: Boxes, label: "Site kit", detail: "Approved device standards" },
            { href: "/access", icon: Settings2, label: "Roles & permissions", detail: "Who can do what" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="pf-shortcut" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 4px", borderBottom: "1px solid var(--line)" }}>
              <span className="metric-icon" style={{ background: "var(--surface-strong)", color: "var(--accent)" }}>
                <item.icon size={18} />
              </span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block" }}>{item.label}</strong>
                <small className="pf-muted">{item.detail}</small>
              </span>
              <span className="pf-muted">→</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Health</p><h2>Alert posture</h2></div>
        </div>
        <div className="pf-panel">
          <p className="pf-muted" style={{ margin: 0 }}>
            CPU, memory and monitoring thresholds are tuned per router on the router pages — there is no global override, so upgrades never alter site behaviour.
          </p>
        </div>
      </div>
    </div>
  );
}