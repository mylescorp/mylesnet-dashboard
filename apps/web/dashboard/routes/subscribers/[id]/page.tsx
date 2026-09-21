"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PageHeader, Tabs, TabPanel } from "@mylesnet/ui";
import {
  ArrowLeft,
  Edit,
  RefreshCw,
  DollarSign,
  Wifi,
  Calendar,
  Phone,
  Mail,
  Hash,
  Receipt,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { StatusPill, formatDateTime } from "@/shared/components/ui";
import { subscriberDetail } from "@/shared/convex/subscriberDetail";
import type { Id } from "@/convex/_generated/dataModel";

const statusTone = (status: string) =>
  status === "active"
    ? "success"
    : status === "expired" || status === "churned"
      ? "danger"
      : status === "at_risk"
        ? "warning"
        : "neutral";

export default function SubscriberDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = useQuery(subscriberDetail.getDetail, {
    subscriberId: params.id as Id<"subscribers">,
  });
  const renew = useMutation(api.subscribers.renew);
  const creditAccount = useMutation(api.subscribers.creditAccount);
  const [tab, setTab] = useState("overview");
  const [renewDays, setRenewDays] = useState(30);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [isCrediting, setIsCrediting] = useState(false);
  const [error, setError] = useState("");

  const tabs = useMemo(() => {
    if (!detail) return [];
    return [
      { value: "overview", label: "Overview" },
      { value: "payments", label: "Payments", badge: detail.payments.length },
      { value: "invoices", label: "Invoices", badge: detail.invoices.length },
      { value: "activity", label: "Activity", badge: detail.audit.length },
    ];
  }, [detail]);

  if (detail === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading subscriber…</div>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="workspace-page">
        <PageHeader
          eyebrow="Customers"
          title="Subscriber not found"
          description="The requested subscriber does not exist"
        />
        <div className="pf-panel">
          <Link href="/subscribers" className="secondary-button">
            Back to subscribers
          </Link>
        </div>
      </div>
    );
  }

  const { subscriber, plan, payments, invoices, audit } = detail;

  const handleRenew = async () => {
    setIsRenewing(true);
    setError("");
    try {
      await renew({
        id: subscriber._id as Id<"subscribers">,
        days: renewDays,
      });
      window.location.reload();
    } catch (err: unknown) {
      setError(
        userFacingMessage(err, "Failed to renew subscription"),
      );
      setIsRenewing(false);
    }
  };

  const handleCredit = async () => {
    setIsCrediting(true);
    setError("");
    try {
      await creditAccount({
        id: subscriber._id as Id<"subscribers">,
        amount: creditAmount,
        reason: creditReason,
      });
      window.location.reload();
    } catch (err: unknown) {
      setError(userFacingMessage(err, "Failed to credit account"));
      setIsCrediting(false);
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Customers"
        title="Subscriber details"
        description={`Manage ${subscriber.name}'s account and subscription`}
        actions={
          <Link href="/subscribers" className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to subscribers
          </Link>
        }
      />

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      <div className="pf-panel">
        <div className="subscriber-detail">
          <div className="subscriber-info">
            <h2>
              {subscriber.name}{" "}
              <StatusPill tone={statusTone(subscriber.status)}>
                {subscriber.status.replace("_", " ")}
              </StatusPill>
            </h2>
            <p className="subscriber-phone">
              <Hash size={14} aria-hidden="true" /> {subscriber.accountNumber}
            </p>
            <p className="subscriber-phone">
              <Phone size={14} aria-hidden="true" /> {subscriber.phone}
            </p>
            {subscriber.email && (
              <p className="subscriber-email">
                <Mail size={14} aria-hidden="true" /> {subscriber.email}
              </p>
            )}
            {subscriber.username && (
              <p className="subscriber-email">
                <Wifi size={14} aria-hidden="true" /> Username:{" "}
                {subscriber.username}
              </p>
            )}
            {subscriber.macAddress && (
              <p className="subscriber-email">MAC: {subscriber.macAddress}</p>
            )}
          </div>
          <div className="subscriber-actions">
            <Link
              href={`/subscribers/${subscriber._id}/edit`}
              className="secondary-button"
            >
              <Edit size={16} aria-hidden="true" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="pf-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Calendar size={20} aria-hidden="true" />
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Subscription
              </p>
              <strong style={{ fontSize: "18px" }}>
                {subscriber.expiryDate
                  ? `Expires ${new Date(subscriber.expiryDate).toLocaleDateString()}`
                  : "No expiry set"}
              </strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            {plan ? `${plan.name} · ${plan.currency} ${plan.priceLocal}` : "No plan assigned"}
          </p>
        </div>

        <div className="pf-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <DollarSign size={20} aria-hidden="true" />
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Wallet balance
              </p>
              <strong style={{ fontSize: "18px" }}>
                {subscriber.currency} {subscriber.walletBalance.toLocaleString()}
              </strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            Available credit
          </p>
        </div>

        <div className="pf-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Wifi size={20} aria-hidden="true" />
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Connection type
              </p>
              <strong style={{ fontSize: "18px" }}>
                {subscriber.connectionType.toUpperCase()}
              </strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            Network access method
          </p>
        </div>

        <div className="pf-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Receipt size={20} aria-hidden="true" />
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Lifetime paid
              </p>
              <strong style={{ fontSize: "18px" }}>
                {subscriber.currency} {detail.lifetimeTotal.toLocaleString()}
              </strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            {detail.lastPayment
              ? `Last: ${formatDateTime(detail.lastPayment.paymentDate)} · ${detail.totalPaidCount} payment${detail.totalPaidCount === 1 ? "" : "s"}`
              : "No completed payments yet"}
          </p>
        </div>
      </div>

      <Tabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel="Subscriber sections"
      />

      <TabPanel value="overview" selected={tab}>
        <div className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Actions</p>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="pf-panel">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw
                    size={16}
                    aria-hidden="true"
                    style={{ marginRight: "8px" }}
                  />
                  Renew subscription
                </h3>
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "12px" }}
                >
                  <input
                    type="number"
                    value={renewDays}
                    onChange={(e) => setRenewDays(Number(e.target.value))}
                    min={1}
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                  <span style={{ display: "flex", alignItems: "center" }}>
                    days
                  </span>
                </div>
                <button
                  onClick={handleRenew}
                  disabled={isRenewing}
                  className="primary-button"
                  style={{ width: "100%" }}
                >
                  {isRenewing ? "Renewing..." : "Renew"}
                </button>
              </div>

              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  <DollarSign
                    size={16}
                    aria-hidden="true"
                    style={{ marginRight: "8px" }}
                  />
                  Credit account
                </h3>
                <div style={{ marginBottom: "12px" }}>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                    min={0}
                    placeholder="Amount"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "8px",
                    }}
                  />
                  <input
                    type="text"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="Reason"
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                </div>
                <button
                  onClick={handleCredit}
                  disabled={isCrediting}
                  className="secondary-button"
                  style={{ width: "100%" }}
                >
                  {isCrediting ? "Crediting..." : "Credit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="payments" selected={tab}>
        <div className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ledger</p>
              <h2>Payment history</h2>
            </div>
          </div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Gateway</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="pf-muted">
                        No payments recorded.
                      </td>
                    </tr>
                  )}
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>{formatDateTime(p.paymentDate)}</td>
                      <td>{p.gateway}</td>
                      <td>{p.reference}</td>
                      <td>
                        <strong>
                          {p.currency} {p.amount.toLocaleString()}
                        </strong>
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            p.status === "completed"
                              ? "success"
                              : p.status === "failed"
                                ? "danger"
                                : p.status === "refunded"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {p.status}
                        </StatusPill>
                      </td>
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Billing</p>
              <h2>Invoices</h2>
            </div>
          </div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Issued</th>
                    <th className="pf-hide-sm">Due</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="pf-muted">
                        No invoices for this subscriber.
                      </td>
                    </tr>
                  )}
                  {invoices.map((inv) => (
                    <tr key={inv._id}>
                      <td>
                        <strong>{inv.invoiceNumber}</strong>
                      </td>
                      <td>{formatDateTime(inv.createdAt)}</td>
                      <td className="pf-hide-sm">
                        {inv.dueDate ? formatDateTime(inv.dueDate) : "—"}
                      </td>
                      <td>
                        {inv.currency} {inv.total.toLocaleString()}
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            inv.status === "paid"
                              ? "success"
                              : inv.status === "overdue"
                                ? "danger"
                                : inv.status === "cancelled"
                                  ? "neutral"
                                  : "warning"
                          }
                        >
                          {inv.status}
                        </StatusPill>
                      </td>
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audit</p>
              <h2>Activity trail</h2>
            </div>
          </div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th className="pf-hide-sm">Before</th>
                    <th className="pf-hide-sm">After</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={4} className="pf-muted">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                  {audit.map((a) => (
                    <tr key={a._id}>
                      <td>{formatDateTime(a.timestamp)}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Activity size={13} aria-hidden="true" />
                          <strong>{a.action}</strong>
                        </span>
                      </td>
                      <td className="pf-hide-sm">
                        {a.beforeJson ? (
                          <code style={{ fontSize: 12 }} title={a.beforeJson}>
                            {a.beforeJson.slice(0, 48)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="pf-hide-sm">
                        {a.afterJson ? (
                          <code style={{ fontSize: 12 }} title={a.afterJson}>
                            {a.afterJson.slice(0, 48)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
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
