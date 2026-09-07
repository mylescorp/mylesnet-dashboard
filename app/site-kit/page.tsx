"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Router, Wifi, Radio, Boxes } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill } from "@/app/components/ui";

const typeIcon = { mikrotik: Router, outdoor_ap: Radio, indoor_ap: Wifi, extender: Boxes };

export default function SiteKitPage() {
  const configs = useQuery(api.siteKit.listSiteKitConfigs, {});

  if (configs === undefined) return <Loading />;

  const active = configs.filter((c) => c.status === "active");
  const withUps = configs.filter((c) => c.requiresUps).length;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Site kit</h1>
          <p className="page-subtitle">The approved device standard — models and firmware sanctioned for every site role.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Boxes} label="Standards" value={configs.length} tone="primary" detail="Entries" />
        <MetricCard icon={Router} label="Active" value={active.length} tone="success" detail="In effect" />
        <MetricCard icon={Radio} label="Require UPS" value={withUps} tone="warning" detail="Outdoor roles" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Catalogue</p><h2>Approved device standards</h2></div>
        </div>
        <div className="pf-panel">
          {configs.length === 0 ? (
            <EmptyState title="No standards yet" body="Site kit standards appear once published." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Device role</th>
                    <th className="pf-hide-sm">Approved model</th>
                    <th className="pf-hide-sm">Firmware</th>
                    <th>UPS</th>
                    <th className="pf-hide-sm">SNMP profile</th>
                    <th className="pf-hide-sm">Effective</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => {
                    const Icon = typeIcon[c.deviceType] ?? Router;
                    return (
                      <tr key={c._id}>
                        <td><strong><Icon size={14} style={{ verticalAlign: -2 }} /> {c.deviceType.replaceAll("_", " ")}</strong></td>
                        <td className="pf-hide-sm">{c.approvedModel}</td>
                        <td className="pf-hide-sm">{c.approvedFirmwareVersion ?? "—"}</td>
                        <td>{c.requiresUps ? "Required" : "—"}</td>
                        <td className="pf-hide-sm">{c.snmpProfile ?? "—"}</td>
                        <td className="pf-hide-sm">{c.effectiveFrom}</td>
                        <td><StatusPill tone={c.status === "active" ? "success" : "warning"}>{c.status}</StatusPill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
