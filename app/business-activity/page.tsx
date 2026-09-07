"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "../../convex/_generated/api";
import {
  CircleDollarSign,
  CreditCard,
  Download,
  RefreshCw,
  Ticket,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import BillingKpiStrip from "../components/BillingKpiStrip";

type Category = "all" | "subscriber" | "payment" | "voucher" | "ticket";

const categories: { value: Category; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "subscriber", label: "Subscribers" },
  { value: "payment", label: "Payments" },
  { value: "voucher", label: "Vouchers" },
  { value: "ticket", label: "Tickets" },
];

const categoryMetas: Record<string, { label: string; badge: string; icon: typeof UserPlus }> = {
  subscriber: { label: "Subscriber", badge: "event-badge-subscriber", icon: Users },
  payment: { label: "Payment", badge: "event-badge-payment", icon: CreditCard },
  voucher: { label: "Voucher", badge: "event-badge-voucher", icon: Ticket },
  ticket: { label: "Ticket", badge: "event-badge-ticket", icon: Wrench },
  default: { label: "Event", badge: "event-badge-neutral", icon: RefreshCw },
};

export default function BusinessActivityPage() {
  const [filter, setFilter] = useState<Category>("all");
  const [offset, setOffset] = useState(0);
  const pageSize = 50;

  const allEvents = useQuery(api.centipid.getRecentAllEvents, { limit: pageSize, offset });
  const integration = useQuery(api.centipid.getCentipidIntegrationStatus, {});

  const filteredEvents = allEvents?.filter((event) => {
    if (filter === "all") return true;
    return event.category === filter;
  }) ?? [];
  const hasMore = (allEvents?.length ?? 0) === pageSize;

  const exportCSV = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["timestamp", "category", "eventType", "reference", "detail"];
    const rows = filteredEvents.map((event) => {
      let reference = "";
      let detail = "";
      if (event.category === "subscriber") {
        reference = event.centipidSubscriberId;
        detail = `${event.phone ? event.phone + " · " : ""}${event.packageName}${event.name ? ` · ${event.name}` : ""}`;
      } else if (event.category === "payment") {
        reference = event.centipidPaymentId;
        detail = `${event.currency} ${event.amount} · ${event.method} · ${event.subscriberPhone}`;
      } else if (event.category === "voucher") {
        reference = event.centipidVoucherId;
        detail = `${event.packageName}${event.customerPhone ? ` · ${event.customerPhone}` : ""}`;
      } else {
        reference = event.centipidTicketId;
        detail = event.subject;
      }
      return [
        new Date(event.timestamp).toISOString(),
        event.category,
        event.eventType,
        reference,
        detail.replace(/"/g, '""'),
      ].map((cell) => `"${cell}"`);
    });
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `business-events-${new Date().toISOString().split("T")[0]}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Billing &amp; business</p>
          <h1 className="page-title">Business activity</h1>
          <p className="page-subtitle">
            Live subscriber, payment, voucher and ticket events streamed from the Centipid
            billing platform. KPIs roll by day in your local timezone.
          </p>
        </div>
        <div className="page-action-group">
          <button type="button" className="secondary-button" onClick={exportCSV} disabled={filteredEvents.length === 0}>
            <Download size={16} />
            Export CSV
          </button>
          <Link href="/centipid" className="primary-button">
            <CircleDollarSign size={16} />
            Billing settings
          </Link>
        </div>
      </div>

      {integration && !integration.available && (
        <div className="incident-banner" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
          <div>
            <RefreshCw aria-hidden="true" size={18} />
            <div>
              <strong>Billing integration not connected</strong>
              <small>
                Webhooks from the billing platform are still accepted in capture mode, but no
                business events are written until credentials are configured.
              </small>
            </div>
          </div>
          <Link href="/centipid" className="secondary-button">Configure</Link>
        </div>
      )}

      <BillingKpiStrip />

      <div className="workspace-card" style={{ padding: "14px 18px", marginBottom: 16 }}>
        <div className="filter-tabs" role="tablist" aria-label="Filter events">
          {categories.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`filter-tab ${filter === value ? "filter-tab-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {allEvents === undefined ? (
        <div className="workspace-card loading-panel">Loading events…</div>
      ) : filteredEvents.length === 0 ? (
        <div className="workspace-card empty-state">
          <h3>No {filter === "all" ? "" : `${filter} `}events yet</h3>
          <p>
            {filter === "all"
              ? "Business events appear here as Centipid delivers them. Connect the billing integration to start streaming."
              : `No ${filter} events have been recorded yet.`}
          </p>
          {filter === "all" && integration && !integration.available && (
            <Link href="/centipid" className="primary-button">Open billing settings</Link>
          )}
        </div>
      ) : (
        <div className="event-list">
          {filteredEvents.map((event) => {
            const meta = categoryMetas[event.category] ?? categoryMetas.default;
            const Icon = meta.icon;
            return (
              <div key={event._id} className="workspace-card event-item">
                <div className="event-item-top">
                  <div className="event-item-main">
                    <span className="event-item-icon"><Icon aria-hidden="true" size={17} /></span>
                    <div>
                      <p className="event-item-title">
                        {meta.label} · <span className={`event-badge ${meta.badge}`}>{event.eventType}</span>
                      </p>
                      <p className="event-item-meta">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="event-item-details">
                  {event.category === "subscriber" && (
                    <>
                      {event.phone && <span className="event-detail">Phone: <strong>{event.phone}</strong></span>}
                      {event.name && <span className="event-detail">Name: <strong>{event.name}</strong></span>}
                      {event.packageName && <span className="event-detail">Package: <strong>{event.packageName}</strong></span>}
                      <span className="event-detail">ID: <strong>{event.centipidSubscriberId}</strong></span>
                    </>
                  )}
                  {event.category === "payment" && (
                    <>
                      <span className="event-detail">Amount: <strong>{event.currency} {Math.round(event.amount).toLocaleString()}</strong></span>
                      <span className="event-detail">Method: <strong>{event.method}</strong></span>
                      {event.subscriberPhone && <span className="event-detail">Subscriber: <strong>{event.subscriberPhone}</strong></span>}
                      <span className="event-detail">Ref: <strong>{event.centipidPaymentId}</strong></span>
                    </>
                  )}
                  {event.category === "voucher" && (
                    <>
                      {event.packageName && <span className="event-detail">Package: <strong>{event.packageName}</strong></span>}
                      {event.customerPhone && <span className="event-detail">Customer: <strong>{event.customerPhone}</strong></span>}
                      <span className="event-detail">Voucher: <strong>{event.centipidVoucherId}</strong></span>
                    </>
                  )}
                  {event.category === "ticket" && (
                    <>
                      {event.subject && <span className="event-detail">Subject: <strong>{event.subject}</strong></span>}
                      <span className="event-detail">Ticket: <strong>{event.centipidTicketId}</strong></span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="page-action-group">
            {offset > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
              >
                Newer events
              </button>
            )}
            {hasMore && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOffset(offset + pageSize)}
              >
                Older events
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
