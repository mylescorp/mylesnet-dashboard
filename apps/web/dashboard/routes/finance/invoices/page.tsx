"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@mylesnet/ui";
import {
  Receipt,
  Check,
  AlertTriangle,
  Clock,
  Search,
  Plus,
} from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";

export default function InvoicesPage() {
  const invoices = useQuery(api.invoices.list, {});
  const stats = useQuery(api.invoices.getStats, {});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (invoices === undefined || stats === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading invoices…</div>
      </div>
    );
  }

  const filteredInvoices = invoices.filter((i) => {
    if (search && !i.invoiceNumber.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Create and manage customer invoices"
        actions={
          <button className="primary-button">
            <Plus size={16} aria-hidden="true" />
            Create invoice
          </button>
        }
      />

      <div className="metric-grid">
        <MetricCard
          icon={Receipt}
          label="Outstanding"
          value={`KES ${stats.outstandingAmount.toLocaleString()}`}
          detail="Awaiting payment"
          tone="warning"
        />
        <MetricCard
          icon={Check}
          label="Paid"
          value={stats.paid}
          detail="Completed invoices"
          tone="success"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue}
          detail="Past due date"
          tone="danger"
        />
        <MetricCard
          icon={Clock}
          label="Draft"
          value={stats.draft}
          detail="Not yet issued"
          tone="neutral"
        />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Billing</p>
            <h2>Invoice list</h2>
          </div>
          <div className="search-filter">
            <div className="search-input">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by invoice number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="pf-panel">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <Receipt size={48} aria-hidden="true" />
              <p>No invoices found</p>
              <p className="empty-detail">
                Invoices will appear here once created
              </p>
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
                      <td>
                        <strong>{invoice.invoiceNumber}</strong>
                      </td>
                      <td>Subscriber ID: {invoice.subscriberId}</td>
                      <td>
                        {invoice.currency} {invoice.total.toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`status-pill status-pill-${invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "issued" ? "warning" : "neutral"}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td>
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button className="text-button">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
