"use client";

import { useQuery } from "@/app/lib/convex";
import { PageHeader } from "@mylesnet/ui";
import { Network, Users, Activity, Ticket } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/shared/components/ui";
import { networkOps } from "@/shared/convex/networkOps";

const lifecycleTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  active: "success",
  planned: "neutral",
  paused: "warning",
  decommissioned: "danger",
};

export default function DevicesPage() {
  const sites = useQuery(networkOps.listSites, {});

  if (sites === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading network sites…</div>
      </div>
    );
  }

  const totalRevenue = sites.reduce((s, x) => s + x.revenue, 0);

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Network"
        title="Devices · Sites"
        description="Network sites (markets), their clients, plans and operational health"
      />

      <div className="metric-grid">
        <div className="pf-panel">
          <Network size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Sites</p>
          <strong style={{ fontSize: "22px" }}>{sites.length}</strong>
        </div>
        <div className="pf-panel">
          <Users size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Clients</p>
          <strong style={{ fontSize: "22px" }}>
            {sites.reduce((s, x) => s + x.clientCount, 0)}
          </strong>
        </div>
        <div className="pf-panel">
          <Activity size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Live clients</p>
          <strong style={{ fontSize: "22px" }}>
            {sites.reduce((s, x) => s + x.activeClientCount, 0)}
          </strong>
        </div>
        <div className="pf-panel">
          <Ticket size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Open tickets</p>
          <strong style={{ fontSize: "22px" }}>
            {sites.reduce((s, x) => s + x.openTickets, 0)}
          </strong>
        </div>
      </div>

      <div className="pf-panel">
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
                <th className="pf-hide-sm">Country</th>
                <th>Plans</th>
                <th>Clients</th>
                <th className="pf-hide-sm">Revenue</th>
                <th className="pf-hide-lg">Tickets</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && (
                <tr>
                  <td colSpan={8} className="pf-muted">
                    No network sites yet. Markets appear here once created.
                  </td>
                </tr>
              )}
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <strong>{site.name}</strong>
                    {site.installDate && (
                      <div className="pf-muted">Installed {site.installDate}</div>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={lifecycleTone[site.lifecycleStatus] ?? "neutral"}>
                      {site.lifecycleStatus}
                    </StatusPill>
                  </td>
                  <td className="pf-hide-sm">{site.country}</td>
                  <td>{site.planCount}</td>
                  <td>
                    {site.activeClientCount}
                    <span className="pf-muted"> / {site.clientCount}</span>
                  </td>
                  <td className="pf-hide-sm">
                    <strong>{site.currency} {site.revenue.toLocaleString()}</strong>
                    {site.revenue30d > 0 && (
                      <div className="pf-muted">30d: {site.currency} {site.revenue30d.toLocaleString()}</div>
                    )}
                  </td>
                  <td className="pf-hide-lg">{site.openTickets}</td>
                  <td className="pf-actions">
                    <Link href={`/devices/${site.id}`} className="secondary-button">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sites.length > 0 && (
          <p className="pf-muted" style={{ padding: "12px 16px", margin: 0 }}>
            Total site revenue: {sites[0]?.currency}{" "}
            {totalRevenue.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}