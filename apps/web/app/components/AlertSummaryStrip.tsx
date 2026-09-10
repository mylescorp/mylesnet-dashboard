"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";

function Badge({ count, tone = "danger", href, label }: { count: number; tone?: "danger" | "warning" | "neutral"; href: string; label: string }) {
  if (!count) return null;
  return (
    <Link href={href} className={`alert-badge alert-badge-${tone}`}>
      <b>{count}</b>
      {label}
      <ArrowUpRight aria-hidden="true" size={13} />
    </Link>
  );
}

type AlertItem = { key: string; count: number; tone: "danger" | "warning" | "neutral"; href: string; label: string };

export default function AlertSummaryStrip() {
  const alerts = useQuery(api.indicators.getDashboardAlerts, {});
  if (!alerts) return null;

  const raw: AlertItem[] = [
    { key: "collectors", count: alerts.failedCollectors, tone: "danger", href: "/routers", label: "Routers with stale/failed collectors" },
    { key: "aps", count: alerts.accessPointsOffline, tone: "warning", href: "/routers", label: "Access points offline" },
    { key: "events", count: alerts.severeEvents24h, tone: "danger", href: "/incidents", label: "Telemetry events (24h)" },
    { key: "sla", count: alerts.ticketsOverSla, tone: "danger", href: "/tickets", label: "Tickets past SLA" },
    { key: "unreconciled", count: alerts.unreconciledPayments ?? 0, tone: "warning", href: "/business-activity", label: "Unreconciled payments" },
    { key: "expiring", count: alerts.expiring24h ?? 0, tone: "warning", href: "/business-activity", label: "Expiring in 24h" },
    { key: "commissions", count: alerts.commissionsAwaiting, tone: "warning", href: "/commissions", label: "Commissions awaiting approval" },
    { key: "offboard", count: alerts.agentsAwaitingOffboard, tone: "neutral", href: "/agents", label: "Agents awaiting offboarding" },
  ];
  const items = raw
    .map((item) => (item.tone === "neutral" && !alerts.businessVisible ? { ...item, count: 0 } : item))
    .filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <section className="alert-summary-strip" aria-label="Alert summary">
        <div className="alert-summary-head"><AlertTriangle aria-hidden="true" size={15} /><strong>Alerts</strong></div>
        <p className="alert-summary-cleared">No outstanding alerts. All indicators are in the clear.</p>
      </section>
    );
  }

  return (
    <section className="alert-summary-strip" aria-label="Alert summary">
      <div className="alert-summary-head"><span><AlertTriangle aria-hidden="true" size={14} /></span><strong>Open alerts · {alerts.total}</strong></div>
      <div className="alert-summary-counts">
        {items.map((item) => (
          <Badge key={item.key} count={item.count} tone={item.tone} href={item.href} label={item.label} />
        ))}
      </div>
    </section>
  );
}