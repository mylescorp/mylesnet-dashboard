"use client";

import { Globe, Settings2, Wallet } from "lucide-react";
import { PageHeader } from "@mylesnet/ui";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import MetricCard from "@/shared/components/MetricCard";
import { Loading } from "@/shared/components/ui";

export default function SettingsPage() {
  const environment = process.env.NEXT_PUBLIC_CONVEX_URL || "local";
  const isProduction = environment.includes("convex.cloud");
  const markets = useQuery(api.markets.listMarkets, {});
  if (markets === undefined) return <Loading />;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Administration" title="Settings" description="Billing workspace configuration and access controls." />
      <div className="metric-grid">
        <MetricCard icon={Globe} label="Environment" value={isProduction ? "Production" : "Local"} tone={isProduction ? "success" : "warning"} detail={environment} />
        <MetricCard icon={Settings2} label="Markets" value={markets.length} tone="neutral" detail="Configured operating locations" />
        <MetricCard icon={Wallet} label="Currency" value="Multi-currency" tone="accent" detail="Tenant billing and reporting" />
      </div>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Billing platform</p><h2>Configuration boundary</h2></div></div>
        <div className="pf-panel"><p className="pf-muted">Provider, payment, and access configuration is introduced through approved tenant-scoped workflows. Legacy device-monitoring controls are retired.</p></div>
      </section>
    </div>
  );
}
