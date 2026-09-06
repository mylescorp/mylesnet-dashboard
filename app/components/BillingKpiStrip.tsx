"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  ArrowDownToLine,
  CreditCard,
  RefreshCw,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "./UserProfileContext";

const formatMarks = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `UGX ${Math.round(value).toLocaleString()}`;
const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;

export default function BillingKpiStrip() {
  const { user } = useUserProfile();
  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const summary = useQuery(api.centipid.getCentipidBusinessSummary, { tzOffsetMinutes });
  // The live MCP projection is intentionally queried only for callers that
  // have the same Centipid-management permission required by the endpoint.
  // This avoids turning a dashboard card into an authorization failure for
  // users who can view the dashboard but not the Centipid integration.
  const canReadCentipidSnapshot = user?.permissions?.includes("centipid:manage") ?? false;
  const liveSnapshot = useQuery(
    api.centipid.getCentipidLiveSnapshot,
    canReadCentipidSnapshot ? {} : "skip",
  );
  const collectedToday = liveSnapshot?.revenueToday
    ?? summary?.platformSnapshot?.revenueToday
    ?? summary?.today.net;

  return (
    <section className="operations-kpi-strip" aria-label="Billing and business summary">
      <div className="operations-kpi">
        <span><CreditCard aria-hidden="true" size={16} /></span>
        <p>Payments today</p>
        <strong>{summary?.today.paymentCount ?? "—"}</strong>
        <small>{summary ? `7d: ${summary.last7d.paymentCount}` : "Waiting for data."}</small>
      </div>
      <div className="operations-kpi">
        <span><ArrowDownToLine aria-hidden="true" size={16} /></span>
        <p>Collected today</p>
        <strong>{summary?.revenueVisible ? formatMarks(collectedToday) : "—"}</strong>
        <small>
          {summary && !summary.revenueVisible
            ? "Visible to admins only."
            : summary
              ? `Net of refunds · 7d: ${formatMarks(summary.last7d.net)}`
              : "Waiting for data."}
        </small>
      </div>
      <div className="operations-kpi">
        <span><Ticket aria-hidden="true" size={16} /></span>
        <p>Vouchers redeemed</p>
        <strong>{summary?.today.vouchersRedeemed ?? "—"}</strong>
        <small>
          {summary
            ? `Generated: ${summary.today.vouchersGenerated} · redemption ${formatPct(summary.today.redemptionRate)}`
            : "Waiting for data."}
        </small>
      </div>
      <div className="operations-kpi">
        <span><Users aria-hidden="true" size={16} /></span>
        <p>New subscribers</p>
        <strong>{summary?.today.subscriberCreated ?? "—"}</strong>
        <small>{summary ? `Paused: ${summary.today.subscriberPaused} · Resumed: ${summary.today.subscriberResumed}` : "Waiting for data."}</small>
      </div>
      <div className="operations-kpi">
        <span><RefreshCw aria-hidden="true" size={16} /></span>
        <p>Paused right now</p>
        <strong>{summary?.live.pausedSubscribers ?? "—"}</strong>
        <small>Subscribers with an active pause</small>
      </div>
      <div className="operations-kpi">
        <span><Wrench aria-hidden="true" size={16} /></span>
        <p>Open tickets</p>
        <strong>{summary?.live.openTickets ?? "—"}</strong>
        <small>
          {summary
            ? `Opened today: ${summary.today.ticketsOpened} · Resolved: ${summary.today.ticketsResolved}`
            : "Waiting for data."}
        </small>
      </div>
    </section>
  );
}
