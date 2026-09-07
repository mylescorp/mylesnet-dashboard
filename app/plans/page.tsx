"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Package, Radio, Tv, Home, CheckSquare } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

const categoryIcon = { data: Radio, tv: Tv, home_bundle: Home };

const n = (v: number) => v.toLocaleString("en");

export default function PlansPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const plans = useQuery(
    api.plans.listPlans,
    marketId ? { marketId: marketId as Id<"markets">, includeInactive } : { includeInactive },
  );

  if (markets === undefined || plans === undefined) return <Loading />;

  const active = plans.filter((p) => p.status === "active");
  const data = plans.filter((p) => p.category === "data").length;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Business</p>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">The package catalogue across markets — data, TV and home bundles.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={marketId} onChange={(e) => setMarketId(e.target.value)} aria-label="Filter by market">
            <option value="">All markets</option>
            {markets.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Package} label="Plans" value={plans.length} tone="primary" detail="In catalogue" />
        <MetricCard icon={CheckSquare} label="Active" value={active.length} tone="success" detail="On sale now" />
        <MetricCard icon={Radio} label="Data plans" value={data} tone="accent" detail="Internet packages" />
      </div>

      <label className="access-role-check" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        <span>Show inactive plans</span>
      </label>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Catalogue</p><h2>Plans</h2></div>
        </div>
        <div className="pf-panel">
          {plans.length === 0 ? (
            <EmptyState title="No plans yet" body="Plans appear here once created for a market." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th className="pf-hide-sm">Code</th>
                    <th>Category</th>
                    <th>Market</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const Icon = categoryIcon[p.category] ?? Package;
                    return (
                      <tr key={p._id}>
                        <td><strong>{p.name}</strong></td>
                        <td className="pf-hide-sm"><code>{p.code}</code></td>
                        <td><StatusPill tone="neutral"><Icon size={13} style={{ verticalAlign: -2 }} /> {p.category}</StatusPill></td>
                        <td>{markets.find((m) => m._id === p.marketId)?.name ?? "National"}</td>
                        <td>{n(p.priceLocal)} {p.currency}{p.durationLabel ? ` / ${p.durationLabel}` : ""}</td>
                        <td><StatusPill tone={p.status === "active" ? "success" : "warning"}>{p.status}</StatusPill></td>
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
