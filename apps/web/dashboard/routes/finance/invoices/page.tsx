"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@mylesnet/ui";
import { AlertTriangle, Check, Clock, Plus, Receipt } from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";
import { ErrorNote, Loading, Select, StatusPill, TextInput } from "@/shared/components/ui";
import { useUserProfile } from "@/shared/components/UserProfileContext";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { draft: "neutral", issued: "warning", paid: "success", overdue: "danger", cancelled: "neutral" };

export default function InvoicesPage() {
  const { user } = useUserProfile();
  const invoices = useQuery(api.invoices.list, {});
  const stats = useQuery(api.invoices.getStats, {});
  const subscribers = useQuery(api.subscribers.list, {});
  const createInvoice = useMutation(api.invoices.create);
  const issueInvoice = useMutation(api.invoices.issue);
  const markInvoicePaid = useMutation(api.invoices.markPaid);
  const cancelInvoice = useMutation(api.invoices.cancel);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subscriberId: "", currency: "KES", subtotal: "", tax: "", discount: "", dueDate: "" });

  if (invoices === undefined || stats === undefined || subscribers === undefined) return <Loading />;

  const canCreate = user?.permissions?.includes("invoices:create") === true;
  const canIssue = user?.permissions?.includes("invoices:issue") === true;
  const canMarkPaid = user?.permissions?.includes("invoices:mark_paid") === true;
  const canCancel = user?.permissions?.includes("invoices:cancel") === true;
  const subscriberName = (id?: Id<"subscribers">) => subscribers.find((s) => s._id === id)?.name ?? "Subscriber ID: " + (id ?? "—");

  const filteredInvoices = invoices.filter((i) => {
    if (search && !i.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  const reset = () => { setFormOpen(false); setError(null); setForm({ subscriberId: "", currency: "KES", subtotal: "", tax: "", discount: "", dueDate: "" }); };

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : "Invoice action failed"); }
  };

  const create = async () => {
    setError(null);
    try {
      const subtotal = Number(form.subtotal);
      const tax = Number(form.tax || 0);
      const discount = Number(form.discount || 0);
      if (!Number.isFinite(subtotal) || subtotal <= 0) throw new Error("Enter a valid subtotal greater than zero");
      if (!Number.isFinite(tax) || !Number.isFinite(discount)) throw new Error("Tax and discount must be numbers");
      const total = subtotal + tax - discount;
      if (total <= 0) throw new Error("Total must be greater than zero");
      await createInvoice({
        invoiceNumber: `INV-${Date.now()}`,
        subscriberId: form.subscriberId ? (form.subscriberId as Id<"subscribers">) : undefined,
        currency: form.currency.trim(),
        subtotal,
        tax,
        discount,
        total,
        dueDate: form.dueDate ? new Date(form.dueDate).getTime() : undefined,
        lineItems: [{ description: "Internet service", quantity: 1, unitPrice: subtotal, total: subtotal }],
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice");
    }
  };

  const cancel = (id: Id<"invoices">) => {
    const reason = window.prompt("Cancellation reason (recorded in the audit log):", "Issued in error");
    if (reason === null) return;
    run(() => cancelInvoice({ id, reason: reason.trim() || "Issued in error" }));
  };

  const subtotal = Number(form.subtotal || 0);
  const tax = Number(form.tax || 0);
  const discount = Number(form.discount || 0);
  const total = subtotal + tax - discount;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Create and manage customer invoices"
        actions={canCreate ? (
          <button className="primary-button" onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Create invoice
          </button>
        ) : undefined}
      />

      <div className="metric-grid">
        <MetricCard icon={Receipt} label="Outstanding" value={`${stats.outstandingAmount.toLocaleString()}`} detail="Awaiting payment" tone="warning" />
        <MetricCard icon={Check} label="Paid" value={stats.paid} detail="Completed invoices" tone="success" />
        <MetricCard icon={AlertTriangle} label="Overdue" value={stats.overdue} detail="Past due date" tone="danger" />
        <MetricCard icon={Clock} label="Draft" value={stats.draft} detail="Not yet issued" tone="neutral" />
      </div>

      {error && <div className="section-block"><ErrorNote>{error}</ErrorNote></div>}

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Billing</p>
            <h2>Invoice list</h2>
          </div>
          <div className="search-filter">
            <div className="search-input">
              <input type="text" placeholder="Search by invoice number..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {["draft", "issued", "paid", "overdue", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="pf-panel">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <Receipt size={48} aria-hidden="true" />
              <p>No invoices found</p>
              <p className="empty-detail">Invoices will appear here once created</p>
            </div>
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Due date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice._id}>
                      <td><strong>{invoice.invoiceNumber}</strong></td>
                      <td>{subscriberName(invoice.subscriberId)}</td>
                      <td>{invoice.currency} {invoice.total.toLocaleString()}</td>
                      <td><StatusPill tone={STATUS_TONE[invoice.status]}>{invoice.status}</StatusPill></td>
                      <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</td>
                      <td>
                        {canIssue && invoice.status === "draft" && <button className="text-button" onClick={() => run(() => issueInvoice({ id: invoice._id }))}>Issue</button>}
                        {canMarkPaid && (invoice.status === "issued" || invoice.status === "overdue") && <button className="text-button" onClick={() => run(() => markInvoicePaid({ id: invoice._id }))}>Mark paid</button>}
                        {canCancel && (invoice.status === "draft" || invoice.status === "issued" || invoice.status === "overdue") && <button className="text-button" onClick={() => cancel(invoice._id)}>Cancel</button>}
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
              <div><p className="eyebrow">Create</p><h2>New invoice</h2></div>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="pf-field"><span className="pf-label">Subscriber</span>
                <Select value={form.subscriberId} onChange={(e) => { const sub = subscribers.find((s) => s._id === e.target.value); setForm({ ...form, subscriberId: e.target.value, currency: sub?.currency ?? form.currency }); }}>
                  <option value="">Unattributed</option>
                  {subscribers.map((s) => <option key={s._id} value={s._id}>{s.name} · {s.accountNumber}</option>)}
                </Select>
              </label>
              <label className="pf-field"><span className="pf-label">Currency</span>
                <TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Subtotal *</span>
                <TextInput type="number" min={0} value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Tax</span>
                <TextInput type="number" min={0} value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Discount</span>
                <TextInput type="number" min={0} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              </label>
              <label className="pf-field"><span className="pf-label">Due date</span>
                <TextInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </label>
              <div className="pf-field"><span className="pf-label">Total</span><strong>{form.currency} {Number.isFinite(total) ? total.toLocaleString() : "—"}</strong></div>
            </div>
            <div className="pf-actions">
              <button className="pf-button pf-button-primary" onClick={create}>Create invoice</button>
              <button className="pf-button" onClick={reset}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}