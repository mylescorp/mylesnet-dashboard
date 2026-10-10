"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { platformHealth } from "@/shared/convex/platformHealth";
import { StatusPill } from "@/shared/components/ui";

const refreshMs = 30_000;

export function PlatformSystemHealth() {
  const [probe, setProbe] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setProbe((value) => value + 1), refreshMs);
    return () => window.clearInterval(timer);
  }, []);
  const health = useQuery(platformHealth.getOverview, { probe });

  if (health === undefined) return <main className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Platform operations</p><h1 className="page-title">System health</h1></div></header><p className="pf-muted">Checking service health…</p></main>;

  const webhookLabel = health.workosWebhook.deliveryStatus === "observed_ok"
    ? "Recent deliveries processed"
    : health.workosWebhook.deliveryStatus === "attention"
      ? "Recent delivery issues observed"
      : "No recent delivery data";
  const webhookTone = health.workosWebhook.deliveryStatus === "observed_ok" ? "success" : health.workosWebhook.deliveryStatus === "attention" ? "warning" : "neutral";

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform operations</p><h1 className="page-title">System health</h1><p className="page-subtitle">Service checks refresh every 30 seconds. Unconnected monitors are shown as unmonitored.</p></div><StatusPill tone="success">Updated {new Date(health.checkedAt).toLocaleTimeString()}</StatusPill></header>
    <section className="metric-grid">
      <HealthCard title="Convex" status="Reachable" tone="success" detail="This authenticated health query completed." />
      <HealthCard title="WorkOS delivery path" status={webhookLabel} tone={webhookTone} detail={`${health.workosWebhook.processedSamples} of ${health.workosWebhook.recentDeliverySamples} sampled deliveries were signature-verified and processed in the last 24 hours.`} />
      <HealthCard title="Vercel" status="Unmonitored" tone="neutral" detail="No Vercel health integration is configured in this application." />
      <HealthCard title="Uptime" status="Unmonitored" tone="neutral" detail="No external uptime monitor is connected." />
    </section>
    <section className="pf-panel">
      <div className="section-heading"><div><p className="eyebrow">WorkOS webhook observations</p><h2>Recent queue sample</h2></div><span className="section-count">Up to {health.workosWebhook.queueSampleLimitPerStatus} rows per status</span></div>
      <p className="pf-hint">Counts are bounded samples, not full queue totals. Event payloads and failure details are not returned to this page.</p>
      <dl className="tenant-detail-fields">
        <dt>Received sample</dt><dd>{health.workosWebhook.sampledQueueCounts.received}</dd>
        <dt>Completed sample</dt><dd>{health.workosWebhook.sampledQueueCounts.completed}</dd>
        <dt>Retry sample</dt><dd>{health.workosWebhook.sampledQueueCounts.retry}</dd>
        <dt>Quarantined sample</dt><dd>{health.workosWebhook.sampledQueueCounts.quarantined}</dd>
        <dt>Signature-valid deliveries</dt><dd>{health.workosWebhook.signatureValidSamples}</dd>
      </dl>
    </section>
  </main>;
}

function HealthCard({ title, status, tone, detail }: { title: string; status: string; tone: "success" | "warning" | "neutral"; detail: string }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><p>{title}</p><strong>{status}</strong><small>{detail}</small></article>;
}
