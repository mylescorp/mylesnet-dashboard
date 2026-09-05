"use client";

import { useQuery } from "convex/react";
import { Activity } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfigWatchPanel } from "@/app/components/router/ConfigWatchPanel";

export default function ConfigWatchPage() {
  const routers = useQuery(api.routers.listRouters, {});
  if (routers === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading config watch…</div></div>;
  }
  return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations · Monitoring</p><h1 className="page-title">Config watch</h1><p className="page-subtitle">Capture a snapshot of a router&apos;s monitored RouterOS configuration as a baseline, then compare current snapshots against it to detect unauthorized or unexpected change.</p></div></header>{routers.length === 0 ? <p className="dialog-message">Register a router first — config watch needs a collector configuration snapshot to baseline.</p> : <section className="space-y-4">{routers.map((router) => <BaselineCard key={router._id} routerId={router._id} name={router.name} location={router.location} />)}</section>}</div>;
}

function BaselineCard({ routerId, name, location }: { routerId: Id<"routers">; name: string; location: string }) {
  return <section className="workspace-card console-card"><div className="section-heading"><div><p className="eyebrow">Config watch · {location}</p><h2><Link href={`/routers/${routerId}`} className="hover:text-orange-700">{name}</Link></h2></div></div><ConfigWatchPanel routerId={routerId} /></section>;
}