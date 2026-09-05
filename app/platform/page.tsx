"use client";

import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Boxes, CircleDollarSign, Users, ShieldPlus, Ticket, RefreshCw, ArrowDownToLine } from "lucide-react";
import { useMemo, useState } from "react";

export default function PlatformDashboardPage() {
  const metrics = useQuery(api.platform.getPlatformDashboardMetrics, {});
  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const billingSummary = useQuery(api.centipid.getCentipidBusinessSummary, { tzOffsetMinutes });
  const claimStatus = useQuery(api.bootstrap.ownerClaimStatus, {});
  const claimOwner = useAction(api.bootstrap.claimPlatformOwner);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const missingCostMarkets = metrics?.missingCostMarkets ?? [];
  const unstaffedMarkets = metrics?.unstaffedMarkets ?? 0;
  const activeProspects = metrics?.activeProspects ?? 0;
  const hasActionItems =
    !!metrics &&
    (missingCostMarkets.length > 0 || unstaffedMarkets > 0 || activeProspects > 0);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimMessage(null);
    try {
      // claimOwner returns { claimedBy }
      const result = await claimOwner();
      setClaimMessage(
        result && typeof result.claimedBy === "string"
          ? "You are now the platform owner. Welcome."
          : "Platform owner claimed.",
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setClaimMessage(
        error instanceof Error ? error.message : "Could not claim the owner role. It may already be taken.",
      );
    } finally {
      setClaiming(false);
    }
  };

  const showClaim =
    claimStatus && !claimStatus.ownerExists && !claimStatus.isCurrentUserOwner;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Master admin</p>
          <h1 className="page-title">Platform dashboard</h1>
          <p className="page-subtitle">
            A live view across markets, devices, agents, vouchers, commissions and alerts.
          </p>
        </div>
      </div>

      {showClaim && (
        <div className="platform-claim-banner">
          <ShieldPlus aria-hidden="true" size={20} />
          <div>
            <strong>First-time platform setup</strong>
            <small>
              No platform owner is registered yet. Claim the owner role to unlock the Master
              Admin panel. This can only be done once.
            </small>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? "Claiming…" : "Claim owner role"}
          </button>
        </div>
      )}

      {claimMessage && (
        <p className={`platform-claim-message ${claimMessage.startsWith("You are") ? "ok" : ""}`} role="status">
          {claimMessage}
        </p>
      )}

      <div className="metric-grid">
        <div className="metric-card workspace-card metric-card-danger">
          <div className="metric-icon"><AlertTriangle aria-hidden="true" size={20} /></div>
          <p>Open alerts</p>
          <strong>{metrics?.openAlerts ?? "—"}</strong>
          <small>Requiring attention</small>
        </div>
        <div className="metric-card workspace-card metric-card-success">
          <div className="metric-icon"><Boxes aria-hidden="true" size={20} /></div>
          <p>Active markets</p>
          <strong>{metrics?.activeMarkets ?? "—"}</strong>
          <small>Live service areas</small>
        </div>
        <div className="metric-card workspace-card metric-card-warning">
          <div className="metric-icon"><Users aria-hidden="true" size={20} /></div>
          <p>Agents awaiting offboarding</p>
          <strong>{metrics?.pendingOffboard ?? "—"}</strong>
          <small>Terminated, pending close-out</small>
        </div>
        <div className="metric-card workspace-card metric-card-accent">
          <div className="metric-icon"><CircleDollarSign aria-hidden="true" size={20} /></div>
          <p>Commissions awaiting approval</p>
          <strong>{metrics?.awaitingApproval ?? "—"}</strong>
          <small>Requested payouts</small>
        </div>
      </div>

      <div className="platform-action-items">
        <h2 className="section-heading" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 19, fontWeight: 750 }}>Billing &amp; business</span>
        </h2>
        <div className="operations-kpi-strip" style={{ marginBottom: 0 }}>
          <div className="operations-kpi">
            <span><CircleDollarSign aria-hidden="true" size={16} /></span>
            <p>Payments today</p>
            <strong>{billingSummary?.today.paymentCount ?? "—"}</strong>
            <small>{billingSummary ? `7d: ${billingSummary.last7d.paymentCount}` : "Waiting for data."}</small>
          </div>
          <div className="operations-kpi">
            <span><ArrowDownToLine aria-hidden="true" size={16} /></span>
            <p>Collected today</p>
            <strong>
              {billingSummary?.revenueVisible
                ? billingSummary.today.net === null || billingSummary.today.net === undefined
                  ? "—"
                  : `UGX ${Math.round(billingSummary.today.net).toLocaleString()}`
                : "—"}
            </strong>
            <small>{billingSummary && !billingSummary.revenueVisible ? "Visible to admins only." : "Net of refunds."}</small>
          </div>
          <div className="operations-kpi">
            <span><Ticket aria-hidden="true" size={16} /></span>
            <p>Vouchers redeemed</p>
            <strong>{billingSummary?.today.vouchersRedeemed ?? "—"}</strong>
            <small>Generated: {billingSummary?.today.vouchersGenerated ?? "—"}</small>
          </div>
          <div className="operations-kpi">
            <span><RefreshCw aria-hidden="true" size={16} /></span>
            <p>Paused right now</p>
            <strong>{billingSummary?.live.pausedSubscribers ?? "—"}</strong>
            <small>Subscribers with an active pause</small>
          </div>
          <div className="operations-kpi">
            <span><Users aria-hidden="true" size={16} /></span>
            <p>Open tickets</p>
            <strong>{billingSummary?.live.openTickets ?? "—"}</strong>
            <small>Live support queue</small>
          </div>
          <div className="operations-kpi">
            <span><CircleDollarSign aria-hidden="true" size={16} /></span>
            <p>Events</p>
            <strong>
              <Link href="/business-activity" style={{ color: "inherit", textDecoration: "none" }}>Open</Link>
            </strong>
            <small>Full business activity feed</small>
          </div>
        </div>
      </div>

      <div className="platform-action-items">
        <h2 className="section-heading" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 19, fontWeight: 750 }}>Action items</span>
        </h2>
        {hasActionItems ? (
          <div className="platform-actions-grid">
            {missingCostMarkets.length > 0 && (
              <Link href="/platform/markets" className="platform-action-card platform-action-card-warning">
                <strong>Missing operating costs — {missingCostMarkets.length}</strong>
                <span>
                  {missingCostMarkets.map((m) => m.name).join(", ")} have no cost entry for this month.
                  Missing entries are a visible gap in break-even, never silently defaulted.
                </span>
              </Link>
            )}
            {unstaffedMarkets > 0 && (
              <Link href="/platform/markets" className="platform-action-card platform-action-card-warning">
                <strong>Unstaffed markets — {unstaffedMarkets}</strong>
                <span>
                  {unstaffedMarkets} active market(s) have no active agent assignment. Assign an agent.
                </span>
              </Link>
            )}
            {activeProspects > 0 && (
              <Link href="/platform/prospects" className="platform-action-card platform-action-card-accent">
                <strong>Prospects in pipeline — {activeProspects}</strong>
                <span>
                  {activeProspects} prospect(s) not yet operational. Advance or provision them.
                </span>
              </Link>
            )}
          </div>
        ) : (
          <p className="pf-muted">No outstanding action items.</p>
        )}
      </div>

      <div className="platform-quick-links">
        <h2 className="section-heading" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 19, fontWeight: 750 }}>Manage</span>
        </h2>
        <div className="platform-quick-grid">
          {[
            { href: "/platform/markets", label: "Markets", desc: "Service areas and operating costs" },
            { href: "/platform/devices", label: "Devices", desc: "Gateways, APs and replacement log" },
            { href: "/platform/agents", label: "Agents", desc: "Assignments and offboarding" },
            { href: "/platform/vouchers", label: "Vouchers", desc: "Batches and redemption" },
            { href: "/platform/commissions", label: "Commissions", desc: "Payout approval workflow" },
            { href: "/platform/alerts", label: "Alerts", desc: "Root-cause grouped incidents" },
          ].map(({ href, label, desc }) => (
            <Link key={href} href={href} className="platform-quick-card">
              <strong>{label}</strong>
              <span>{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
