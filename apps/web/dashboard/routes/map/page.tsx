"use client";

import { useMemo } from "react";
import { useQuery } from "@/app/lib/convex";
import { PageHeader } from "@mylesnet/ui";
import { MapPin, Users, Activity, Globe } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/shared/components/ui";
import { networkOps } from "@/shared/convex/networkOps";

const siteTone = (status: string) =>
  status === "active" ? "success" : status === "paused" ? "warning" : status === "decommissioned" ? "danger" : "neutral";

export default function FiberMapPage() {
  const sites = useQuery(networkOps.listSites, {});

  const byCountry = useMemo(() => {
    if (!sites) return [];
    const grouped = new Map<string, typeof sites>();
    for (const site of sites) {
      const list = grouped.get(site.country) ?? [];
      list.push(site);
      grouped.set(site.country, list);
    }
    return [...grouped.entries()];
  }, [sites]);

  if (sites === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card">Loading fiber map…</div></div>;
  }

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Network"
        title="Fiber map"
        description="Network fabric by country \u2014 nodes are live sites, sized by real client counts"
      />

      <div className="metric-grid">
        <div className="pf-panel">
          <Globe size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Countries</p>
          <strong style={{ fontSize: "22px" }}>{byCountry.length}</strong>
        </div>
        <div className="pf-panel">
          <MapPin size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Nodes</p>
          <strong style={{ fontSize: "22px" }}>{sites.length}</strong>
        </div>
        <div className="pf-panel">
          <Users size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Clients on fabric</p>
          <strong style={{ fontSize: "22px" }}>{sites.reduce((s, x) => s + x.clientCount, 0)}</strong>
        </div>
        <div className="pf-panel">
          <Activity size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Live now</p>
          <strong style={{ fontSize: "22px" }}>{sites.reduce((s, x) => s + x.activeClientCount, 0)}</strong>
        </div>
      </div>

      {byCountry.length === 0 && (
        <div className="pf-panel"><p className="pf-muted" style={{ margin: 0 }}>No network sites yet.</p></div>
      )}

      {byCountry.map(([country, nodes]) => (
        <div className="section-block" key={country}>
          <div className="section-heading"><div><p className="eyebrow">Node</p><h2>{country}</h2></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {nodes.map((site) => (
              <Link key={site.id} href={`/devices/${site.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="pf-panel" style={{ height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <strong style={{ fontSize: 16 }}>{site.name}</strong>
                    <StatusPill tone={siteTone(site.lifecycleStatus)}>{site.lifecycleStatus}</StatusPill>
                  </div>
                  {site.coordinates && (
                    <p className="pf-muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                      <MapPin size={12} aria-hidden="true" /> {site.coordinates.lat.toFixed(4)}, {site.coordinates.lng.toFixed(4)}
                    </p>
                  )}
                  {site.installDate && <p className="pf-muted" style={{ margin: "0 0 8px", fontSize: 12 }}>Installed {site.installDate}</p>}
                  <div style={{ display: "flex", gap: "16px", borderTop: "1px solid var(--line)", paddingTop: 10, fontSize: 13 }}>
                    <span><Users size={13} aria-hidden="true" /> {site.activeClientCount}/{site.clientCount}</span>
                    <span><Activity size={13} aria-hidden="true" /> {site.planCount} plans</span>
                    <span>{site.currency} {site.revenue30d.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <p className="pf-muted" style={{ fontSize: 12 }}>
        Revenue figures are 30-day completed payments mapped to each site&apos;s plans and clients.
      </p>
    </div>
  );
}