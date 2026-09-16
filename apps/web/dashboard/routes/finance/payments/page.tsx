"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@mylesnet/ui";
import { DollarSign, Check, X, RefreshCw, Search, Plus } from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";

export default function PaymentsPage() {
  const payments = useQuery(api.payments.list, {});
  const stats = useQuery(api.payments.getStats, {});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (payments === undefined || stats === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading payments…</div>
      </div>
    );
  }

  const filteredPayments = payments.filter((p) => {
    if (search && !p.reference.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="View and manage payment transactions"
        actions={
          <button className="primary-button">
            <Plus size={16} aria-hidden="true" />
            Record payment
          </button>
        }
      />

      <div className="metric-grid">
        <MetricCard
          icon={DollarSign}
          label="Total collected"
          value={`KES ${stats.totalAmount.toLocaleString()}`}
          detail="This period"
          tone="primary"
        />
        <MetricCard
          icon={Check}
          label="Completed"
          value={stats.completed}
          detail="Successful payments"
          tone="success"
        />
        <MetricCard
          icon={RefreshCw}
          label="Pending"
          value={stats.pending}
          detail="Awaiting completion"
          tone="warning"
        />
        <MetricCard
          icon={X}
          label="Failed"
          value={stats.failed}
          detail="Failed transactions"
          tone="danger"
        />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transactions</p>
            <h2>Payment history</h2>
          </div>
          <div className="search-filter">
            <div className="search-input">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
        <div className="pf-panel">
          {filteredPayments.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={48} aria-hidden="true" />
              <p>No payments found</p>
              <p className="empty-detail">
                Payments will appear here once recorded
              </p>
            </div>
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Reference</th>
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
                      <td>
                        <strong>{payment.reference}</strong>
                      </td>
                      <td>
                        {payment.currency} {payment.amount.toLocaleString()}
                      </td>
                      <td>{payment.gateway}</td>
                      <td>
                        <span
                          className={`status-pill status-pill-${payment.status === "completed" ? "success" : payment.status === "failed" ? "danger" : "warning"}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td>
                        {new Date(payment.paymentDate).toLocaleDateString()}
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
