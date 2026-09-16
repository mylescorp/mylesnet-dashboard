"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Users, UserPlus, Percent, Search, Plus } from "lucide-react";
import { PageHeader, Select } from "@mylesnet/ui";
import MetricCard from "@/shared/components/MetricCard";
import SimpleBars from "@/shared/components/SimpleBars";
import { EmptyState, Loading, StatusPill } from "@/shared/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

export default function SubscribersPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const trend = useQuery(
    api.analytics.getSubscriberTrend,
    marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 },
  );
  
  // New subscriber management queries
  const subscribers = useQuery(api.subscribers.list, {});
  const subscriberStats = useQuery(api.subscribers.getStats, {});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [connectionTypeFilter, setConnectionTypeFilter] = useState("");

  if (markets === undefined || trend === undefined || subscribers === undefined || subscriberStats === undefined) return <Loading />;

  // Filter subscribers based on search and filters
  const filteredSubscribers = subscribers.filter((s) => {
    const matchesSearch = !searchQuery || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.username && s.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.phone.includes(searchQuery);
    
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesConnectionType = !connectionTypeFilter || s.connectionType === connectionTypeFilter;
    
    return matchesSearch && matchesStatus && matchesConnectionType;
  });

  return (
<div className="workspace-page">
      <PageHeader
        eyebrow="Customers"
        title="Subscribers"
        description="Manage customer accounts, subscriptions, and network access"
        actions={
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ minWidth: 220 }}>
              <Select value={marketId} onChange={(e) => setMarketId(e.target.value)} aria-label="Filter by market">
                <option value="">All markets</option>
                {markets.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </Select>
            </div>
            <Link href="/subscribers/new" className="primary-button">
              <Plus size={16} aria-hidden="true" />
              Add subscriber
            </Link>
          </div>
        }
      />

      <div className="metric-grid">
        <MetricCard icon={Users} label="Total subscribers" value={subscriberStats.total.toLocaleString()} tone="primary" detail="All records" />
        <MetricCard icon={Users} label="Active" value={subscriberStats.active.toLocaleString()} tone="success" detail="Currently active" />
        <MetricCard icon={UserPlus} label="Expiring" value={subscriberStats.expired.toLocaleString()} tone="warning" detail="Requires renewal" />
        <MetricCard icon={Percent} label="Churned" value={subscriberStats.churned.toLocaleString()} tone="danger" detail="Lost customers" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Management</p>
            <h2>Subscriber list</h2>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "36px", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "14px" }}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
              <option value="at_risk">At risk</option>
              <option value="churned">Churned</option>
            </Select>
            <Select value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)} aria-label="Filter by connection type">
              <option value="">All types</option>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </Select>
          </div>
        </div>
        <div className="pf-panel">
          {filteredSubscribers.length === 0 ? (
            <EmptyState title="No subscribers found" body={searchQuery || statusFilter || connectionTypeFilter ? "Try adjusting your filters" : "Add your first subscriber to get started"} />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Expiry</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.map((subscriber) => (
                    <tr key={subscriber._id}>
                      <td><strong>{subscriber.accountNumber}</strong></td>
                      <td>{subscriber.name}</td>
                      <td>{subscriber.phone}</td>
                      <td>
                        <StatusPill tone={subscriber.status === "active" ? "success" : subscriber.status === "expired" ? "danger" : subscriber.status === "suspended" ? "warning" : "neutral"}>
                          {subscriber.status.replace("_", " ")}
                        </StatusPill>
                      </td>
                      <td>{subscriber.connectionType.toUpperCase()}</td>
                      <td>{subscriber.expiryDate ? new Date(subscriber.expiryDate).toLocaleDateString() : "N/A"}</td>
                      <td>{subscriber.currency} {subscriber.walletBalance.toLocaleString()}</td>
                      <td>
                        <Link href={`/subscribers/${subscriber._id}`} className="text-button">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Analytics</p><h2>Growth trend</h2></div>
        </div>
        <div className="pf-panel">
          {trend.length === 0 ? (
            <EmptyState title="No subscriber snapshots yet" body="Daily subscriber counts appear once the nightly rollup runs." />
          ) : (
            <SimpleBars data={trend.map((r) => ({ label: r.date.slice(5), value: r.activeCount }))} />
          )}
        </div>
      </div>
    </div>
  );
}
