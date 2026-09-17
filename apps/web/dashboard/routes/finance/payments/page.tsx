"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@mylesnet/ui";
import { Check, DollarSign, Plus, RefreshCw, X } from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";
import { ErrorNote, Loading, Select, StatusPill, TextInput } from "@/shared/components/ui";
import { useUserProfile } from "@/shared/components/UserProfileContext";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { completed: "success", failed: "danger", pending: "warning", refunded: "neutral" };
const GATEWAYS = ["cash", "mobile_money", "card", "bank_transfer"];
const PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"];

export default function PaymentsPage() {
  const { user } = useUserProfile();
  const payments = useQuery(api.payments.list, {});
  const stats = useQuery(api.payments.getStats, {});
  const subscribers = useQuery(api.subscribers.list, {});
  const createPayment = useMutation(api.payments.create);
  const refundPayment = useMutation(api.payments.refund);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Id<"payments"> | null>(null);
  const [form, setForm] = useState({ subscriberId: "", amount: "", currency: "KES", gateway: "mobile_money", reference: "", status: "completed" });

  if (payments === undefined || stats === undefined || subscribers === undefined) return <Loading />;

  const canCreate = user?.permissions?.includes("payments:create") === true;
  const canRefund = user?.permissions?.includes("payments:refund") === true;
  const subscriberName = (id?: Id<"subscribers">) => subscribers.find((s) => s._id === id)?.name ?? "—";

  const filteredPayments = payments.filter((p) => {
    if (search && !p.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const reset = () => { setFormOpen(false); setViewing(null); setError(null); setForm({ subscriberId: "", amount: "", currency: "KES", gateway: "mobile_money", reference: `PAY-${Date.now()}`, status: "completed" }); };

  const record = async () => {
    setError(null);
    try {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount greater than zero");
      if (!form.reference.trim()) throw new Error("A reference is required");
      await createPayment({
        subscriberId: form.subscriberId ? (form.subscriberId as Id<"subscribers">) : undefined,
        amount,
        currency: form.currency.trim(),
        gateway: form.gateway,
        reference: form.reference.trim(),
        status: form.status as "pending" | "completed" | "failed" | "refunded",
        paymentDate: Date.now(),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    }
  };

  const refund = async (id: Id<"payments">) => {
    setError(null);
    const reason = window.prompt("Refund reason (recorded in the audit log):", "Customer request");
    if (reason === null) return;
    try {
      if (!reason.trim()) throw new Error("A reason is required to refund");
      await refundPayment({ id, reason: reason.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refund payment");
    }
  };

  const viewed = viewing ? payments.find((p) => p._id === viewing) : undefined;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="View and manage payment transactions"
        actions={canCreate ? (
          <button className="primary-button" onClick={() => { setFormOpen(true); setForm({ subscriberId: "", amount: "", currency: "KES", gateway: "mobile_money", reference: `PAY-${Date.now()}`, status: "completed" }); }}>
            <Plus size={16} aria-hidden="true" />
            Record payment
          </button>
        ) : undefined}
      />

      <div className="metric-grid">
        <MetricCard icon={DollarSign} label="Total collected" value={`${stats.totalAmount.toLocaleString()}`} detail="Completed payments" tone="primary" />
        <MetricCard icon={Check} label="Completed" value={stats.completed} detail="Successful payments" tone="success" />
        <MetricCard icon={RefreshCw} label="Pending" value={stats.pending} detail="Awaiting completion" tone="warning" />
        <MetricCard icon={X} label="Failed" value={stats.failed} detail="Failed transactions" tone="danger" />
      </div>

      {error && <div className="section-block"><ErrorNote>{error}</ErrorNote></div>}

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transactions</p>
            <h2>Payment history</h2>
          </div>
          <div className="search-filter">
            <div className="search-input">
              <input type="text" placeholder="Search by reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="pf-panel">
          {filteredPayments.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={48} aria-hidden="true" />
              <p>No payments found</p>
              <p className="empty-detail">Payments will appear here once recorded</p>
            </div>
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Subscriber</th>
                    <th>Amount</th>
                    <th>Gateway</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment._id}>
                      <td><strong>{payment.reference}</strong></td>
                      <td>{subscriberName(payment.subscriberId)}</td>
                      <td>{payment.currency} {payment.amount.toLocaleString()}</td>
                      <td>{payment.gateway}</td>
                      <td><StatusPill tone={STATUS_TONE[payment.status]}>{payment.status}</StatusPill></td>
                      <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                      <td>
                        <button className="text-button" onClick={() => setViewing(payment._id)}>View</button>
                        {canRefund && payment.status === "completed" && (
                          <button className="text-button" onClick={() => refund(payment._id)}>Refund</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="section-block">
          <div className="pf-panel">
            <div className="section-heading">
              <div><p className="eyebrow">Create</p><h2>Record payment</h2></div>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="pf-field"><span className="pf-label">Subscriber</span>
                <Select value={form.subscriberId} onChange={(e) => { const sub = subscribers.find((s) => s._id === e.target.value); setForm({ ...form, subscriberId: e.target.value, currency: sub?.currency ?? form.currency }); }}>
                  <option value="">Unattributed</option>
                  {subscribers.map((s) => <option key={s._id} value={s._id}>{s.name} · {s.accountNumber}</option>)}
                </Select>
              </label>
              <label className="pf-field"><span className="pf-label">Amount *</span>
                <TextInput type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Currency</span>
                <TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Gateway</span>
                <Select value={form.gateway} onChange={(e) => setForm({ ...form, gateway: e.target.value })}>
                  {GATEWAYS.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </label>
              <label className="pf-field"><span className="pf-label">Status</span>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </label>
              <label className="pf-field"><span className="pf-label">Reference *</span>
                <TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </label>
            </div>
            <div className="pf-actions">
              <button className="pf-button pf-button-primary" onClick={record}>Record payment</button>
              <button className="pf-button" onClick={reset}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewed && (
        <div className="section-block">
          <div className="pf-panel">
            <div className="section-heading">
              <div><p className="eyebrow">Detail</p><h2>{viewed.reference}</h2></div>
              <button className="text-button" onClick={() => setViewing(null)}>Close</button>
            </div>
            <div className="pf-form-grid">
              <span className="pf-label">Subscriber</span><span>{subscriberName(viewed.subscriberId)}</span>
              <span className="pf-label">Amount</span><span>{viewed.currency} {viewed.amount.toLocaleString()}</span>
              <span className="pf-label">Gateway</span><span>{viewed.gateway}</span>
              <span className="pf-label">Status</span><span><StatusPill tone={STATUS_TONE[viewed.status]}>{viewed.status}</StatusPill></span>
              <span className="pf-label">Date</span><span>{new Date(viewed.paymentDate).toLocaleString()}</span>
              <span className="pf-label">Plan</span><span>{viewed.planId ? String(viewed.planId) : "—"}</span>
              <span className="pf-label">Invoice</span><span>{viewed.invoiceId ? String(viewed.invoiceId) : "—"}</span>
              <span className="pf-label">Operator</span><span>{viewed.operatorId ? String(viewed.operatorId) : "—"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}