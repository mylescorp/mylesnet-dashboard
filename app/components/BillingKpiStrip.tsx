"use client";

import { useQuery } from "@/app/lib/convex";
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
import Kpi from "./Kpi";

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
      <Kpi label="Payments today" value={summary?.today.paymentCount ?? "—"} detail={summary ? `7d: ${summary.last7d.paymentCount}` : "Waiting for data."} icon={<CreditCard aria-hidden="true" size={16} />} />
      <Kpi
        label="Collected today"
        value={summary?.revenueVisible ? formatMarks(collectedToday) : "—"}
        detail={summary && !summary.revenueVisible
          ? "Visible to admins only."
          : summary
            ? `Net of refunds · 7d: ${formatMarks(summary.last7d.net)}`
            : "Waiting for data."}
        icon={<ArrowDownToLine aria-hidden="true" size={16} />}
      />
      <Kpi
        label="Vouchers redeemed"
        value={summary?.today.vouchersRedeemed ?? "—"}
        detail={summary ? `Generated: ${summary.today.vouchersGenerated} · redemption ${formatPct(summary.today.redemptionRate)}` : "Waiting for data."}
        icon={<Ticket aria-hidden="true" size={16} />}
      />
      <Kpi
        label="New subscribers"
        value={summary?.today.subscriberCreated ?? "—"}
        detail={summary ? `Paused: ${summary.today.subscriberPaused} · Resumed: ${summary.today.subscriberResumed}` : "Waiting for data."}
        icon={<Users aria-hidden="true" size={16} />}
      />
      <Kpi
        label="Paused right now"
        tone={(summary?.live.pausedSubscribers ?? 0) > 0 ? "warn" : "ok"}
        value={summary?.live.pausedSubscribers ?? "—"}
        detail="Subscribers with an active pause"
        icon={<RefreshCw aria-hidden="true" size={16} />}
      />
      <Kpi
        label="Open tickets"
        tone={(summary?.live.openTickets ?? 0) > 0 ? "danger" : "ok"}
        value={summary?.live.openTickets ?? "—"}
        detail={summary ? `Opened today: ${summary.today.ticketsOpened} · Resolved: ${summary.today.ticketsResolved}` : "Waiting for data."}
        icon={<Wrench aria-hidden="true" size={16} />}
      />
    </section>
  );
}

