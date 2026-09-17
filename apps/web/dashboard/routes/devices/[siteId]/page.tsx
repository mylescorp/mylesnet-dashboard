"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { PageHeader, Tabs, TabPanel } from "@mylesnet/ui";
import { ArrowLeft, MapPin, Calendar, Wifi, Activity, Layers } from "lucide-react";
import Link from "next/link";
import { StatusPill, formatDateTime } from "@/shared/components/ui";
import { networkOps, planKindLabel, type PlanKind } from "@/shared/convex/networkOps";
import type { Id } from "@/convex/_generated/dataModel";

const siteTone = (status: string) =>
  status === "active" ? "success" : status === "paused" ? "warning" : status === "decommissioned" ? "danger" : "neutral";

const kindTone = (kind: PlanKind) => (kind === "data" ? "success" : kind === "tv" ? "neutral" : "warning");

export default function SiteDetailPage({ params }: { params: { siteId: string } }) {
  const detail = useQuery(networkOps.getSiteDetail, { siteId: params.siteId as Id<"markets"> });
  const [tab, setTab] = useState("overview");

  const tabs = useMemo(() => {
    if (!detail) return [];
    return [
      { value: "overview", label: "Overview" },
      { value: "clients", label: "Clients", badge: detail.summary.clientCount },
      { value: "plans", label: "Plans", badge: detail.summary.planCount },
      { value: "payments", label: "Payments", badge: detail.payments.length },
      { value: "invoices", label: "Invoices", badge: detail.invoices.length },
      { value: "tickets", label: "Tickets", badge: detail.tickets.length },
      { value: "expenses", label: "Expenses", badge: detail.expenses.length },
      { value: "activity", label: "Activity", badge: detail.audit.length },
    ];
  }, [detail]);

  if (detail === undefined) return <div className="workspace-page"><div className="loading-panel workspace-card">Loading site…</div></div>;
  if (detail === null) return (
    <div className="workspace-page">
      <PageHeader eyebrow="Network" title="Site not found" description="The requested network site does not exist" />
      <div className="pf-panel"><Link href="/devices" className="secondary-button">Back to devices</Link></div>
    </div>
  );

  const { site, summary, plans, clients, payments, invoices, tickets, expenses, audit } = detail;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Network \u00b7 Devices"
        title={site.name}
        description={`${site.country} \u00b7 ${site.status} network node`}
        actions={<Link href="/devices" className="secondary-button"><ArrowLeft size={16} aria-hidden="true" />Back to devices</Link>}
      />
      <div className="metric-grid">
        <div className="pf-panel">
          <Wifi size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Live clients</p>
          <strong style={{ fontSize: "22px" }}>{summary.activeClientCount}</strong>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>of {summary.clientCount} total</p>
        </div>
        <div className="pf-panel">
          <Layers size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Plans</p>
          <strong style={{ fontSize: "22px" }}>{summary.planCount}</strong>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{site.airtelPlanMbps ? `${site.airtelPlanMbps} Mbps backhaul` : "Backhaul n/a"}</p>
        </div>
        <div className="pf-panel">
          <Activity size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Site revenue</p>
          <strong style={{ fontSize: "22px" }}>{site.currency} {summary.revenue.toLocaleString()}</strong>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>lifetime completed payments</p>
        </div>
        <div className="pf-panel">
          <MapPin size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Lifecycle</p>
          <strong style={{ fontSize: "22px" }}><StatusPill tone={siteTone(site.lifecycleStatus)}>{site.lifecycleStatus}</StatusPill></strong>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            {site.coordinates ? `${site.coordinates.lat.toFixed(4)}, ${site.coordinates.lng.toFixed(4)}` : site.installDate ?? "No locality set"}
          </p>
        </div>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Site sections" />

      <TabPanel value="overview" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Site</p><h2>Site profile</h2></div></div>
          <div className="pf-panel">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", fontSize: 14 }}>
              <div><p className="pf-muted" style={{ margin: "0 0 4px" }}>Country</p><strong>{site.country}</strong></div>
              <div><p className="pf-muted" style={{ margin: "0 0 4px" }}>Currency</p><strong>{site.currency}</strong></div>
              <div><p className="pf-muted" style={{ margin: "0 0 4px" }}>Created</p><strong>{formatDateTime(site.createdAt)}</strong></div>
              {site.installDate && <div><p className="pf-muted" style={{ margin: "0 0 4px" }}>Installed</p><strong>{site.installDate}</strong></div>}
              {site.airtelPlanMbps != null && <div><p className="pf-muted" style={{ margin: "0 0 4px" }}>Backhaul</p><strong>{site.airtelPlanMbps} Mbps</strong></div>}
            </div>
            {site.notes && <p style={{ margin: "16px 0 0", fontSize: 14 }}>{site.notes}</p>}
          </div>
        </div>
      </TabPanel>

      <TabPanel value="clients" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Network</p><h2>Clients on this site</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Client</th><th>Username</th><th className="pf-hide-sm">IP / MAC</th><th>Plan</th><th>Type</th><th>Expiry</th><th>Session</th></tr></thead>
                <tbody>
                  {clients.length === 0 && <tr><td colSpan={7} className="pf-muted">No clients assigned to this site&apos;s plans.</td></tr>}
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong><div className="pf-muted">{c.accountNumber}</div></td>
                      <td>{c.username ?? "\u2014"}</td>
                      <td className="pf-hide-sm"><code>{c.ipAddress ?? "\u2014"}</code><div className="pf-muted">{c.macAddress ?? ""}</div></td>
                      <td>{c.planName ?? "\u2014"}{c.planCategory && <div className="pf-muted">{planKindLabel(c.planCategory)}</div>}</td>
                      <td><StatusPill tone={c.connectionType === "pppoe" ? "success" : "neutral"}>{c.connectionType}</StatusPill></td>
                      <td>{c.expiryDate ? formatDateTime(c.expiryDate) : "No expiry"}{c.daysRemaining !== null && <div className="pf-muted">{c.daysRemaining}d left</div>}</td>
                      <td><StatusPill tone={c.isLive ? "success" : "neutral"}>{c.isLive ? "live" : c.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="plans" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Plans</p><h2>Plan kinds on this site</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Code</th><th>Name</th><th>Kind</th><th>Price</th><th className="pf-hide-sm">Duration</th></tr></thead>
                <tbody>
                  {plans.length === 0 && <tr><td colSpan={5} className="pf-muted">No plans are scoped to this site yet.</td></tr>}
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td><code>{p.code}</code></td>
                      <td><strong>{p.name}</strong></td>
                      <td><StatusPill tone={kindTone(p.category)}>{planKindLabel(p.category)}</StatusPill></td>
                      <td>{p.currency} {p.priceLocal.toLocaleString()}</td>
                      <td className="pf-hide-sm">{p.durationLabel ?? "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="payments" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Ledger</p><h2>Recent payments</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Date</th><th>Gateway</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {payments.length === 0 && <tr><td colSpan={5} className="pf-muted">No payments map to this site yet.</td></tr>}
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateTime(p.paymentDate)}</td>
                      <td>{p.gateway}</td>
                      <td>{p.reference}{p.idSuffix && <span className="pf-muted"> \u2026{p.idSuffix}</span>}</td>
                      <td><strong>{p.currency} {p.amount.toLocaleString()}</strong></td>
                      <td><StatusPill tone={p.status === "completed" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="invoices" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Billing</p><h2>Recent invoices</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Number</th><th>Created</th><th className="pf-hide-sm">Due</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.length === 0 && <tr><td colSpan={5} className="pf-muted">No invoices map to this site yet.</td></tr>}
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{formatDateTime(inv.createdAt)}</td>
                      <td className="pf-hide-sm">{inv.dueDate ? formatDateTime(inv.dueDate) : "\u2014"}</td>
                      <td>{inv.currency} {inv.total.toLocaleString()}</td>
                      <td><StatusPill tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : inv.status === "issued" ? "warning" : "neutral"}>{inv.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="tickets" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Support</p><h2>Site tickets</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Subject</th><th>Priority</th><th>Status</th><th className="pf-hide-sm">Created</th></tr></thead>
                <tbody>
                  {tickets.length === 0 && <tr><td colSpan={4} className="pf-muted">No tickets for this site.</td></tr>}
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.subject}</strong></td>
                      <td><StatusPill tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "neutral"}>{t.priority}</StatusPill></td>
                      <td>{t.status.replace(/_/g, " ")}</td>
                      <td className="pf-hide-sm">{formatDateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="expenses" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Opex</p><h2>Site expenses</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Month</th><th>Category</th><th>Type</th><th className="pf-hide-sm">Amount (local)</th><th>Amount (USD)</th></tr></thead>
                <tbody>
                  {expenses.length === 0 && <tr><td colSpan={5} className="pf-muted">No expenses recorded for this site.</td></tr>}
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{e.month}</td>
                      <td>{e.category}</td>
                      <td><StatusPill tone={e.type === "fixed" ? "neutral" : "warning"}>{e.type}</StatusPill></td>
                      <td className="pf-hide-sm"><strong>{e.currency} {e.amountLocal.toLocaleString()}</strong></td>
                      <td>${e.amountUSD.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="activity" selected={tab}>
        <div className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Audit</p><h2>Site activity trail</h2></div></div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Time</th><th>Action</th><th className="pf-hide-sm">Before</th><th className="pf-hide-sm">After</th></tr></thead>
                <tbody>
                  {audit.length === 0 && <tr><td colSpan={4} className="pf-muted">No activity recorded for this site yet.</td></tr>}
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDateTime(a.timestamp)}</td>
                      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Calendar size={13} aria-hidden="true" /><strong>{a.action}</strong></span></td>
                      <td className="pf-hide-sm">{a.beforeJson ? <code style={{ fontSize: 12 }} title={a.beforeJson}>{a.beforeJson.slice(0, 48)}</code> : "\u2014"}</td>
                      <td className="pf-hide-sm">{a.afterJson ? <code style={{ fontSize: 12 }} title={a.afterJson}>{a.afterJson.slice(0, 48)}</code> : "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </TabPanel>
    </div>
  );
}