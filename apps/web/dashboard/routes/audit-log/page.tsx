"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Field, Select, Loading, EmptyState, formatDateTime } from "@/shared/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

const CONFIG = {
  subscriber: { table: "subscribers", label: "Subscribers" },
  market: { table: "markets", label: "Markets" },
  agent: { table: "agents", label: "Agents" },
  voucher: { table: "vouchers", label: "Vouchers" },
  commission: { table: "commissions", label: "Commissions" },
  invoice: { table: "invoices", label: "Invoices" },
  payment: { table: "payments", label: "Payments" },
  plan: { table: "plans", label: "Plans" },
  expense: { table: "expenses", label: "Expenses" },
  team: { table: "teams", label: "Teams" },
} as const;

type Entry = {
  _id: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: Id<"users">;
  timestamp: number;
};

export default function AuditLogPage() {
  const [entityTable, setEntityTable] = useState<string>("");
  const [limit, setLimit] = useState(50);
  const [cursor, setCursor] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isDone, setIsDone] = useState(false);

  const page = useQuery(
    api.auditLogTenant.listForTenant,
    entityTable
      ? { entityTable, limit, cursor }
      : { limit, cursor },
  );
  const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});

  useEffect(() => {
    if (!page) return;
    setEntries((prev) =>
      cursor === null ? (page.entries as Entry[]) : [...prev, ...(page.entries as Entry[])],
    );
    setIsDone(page.isDone);
  }, [page, cursor]);

  if (page === undefined || currentUser === undefined) {
    return <Loading />;
  }

  const currentUserId = currentUser && currentUser._id;

  const reset = () => {
    setCursor(null);
    setEntries([]);
    setIsDone(false);
  };

  const loadMore = () => {
    if (page.continueCursor) setCursor(page.continueCursor);
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">A read-only record of every mutating action in this workspace, newest first.</p>
        </div>
      </div>

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          <Field label="Filter by entity">
            <Select value={entityTable} onChange={(e) => { setEntityTable(e.target.value); reset(); }}>
              <option value="">All entities</option>
              {Object.values(CONFIG).map((c) => (
                <option key={c.table} value={c.table}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Rows">
            <Select value={String(limit)} onChange={(e) => { setLimit(Number(e.target.value)); reset(); }}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="pf-panel">
        {entries.length === 0 ? (
          <EmptyState title="No audit entries" body="Actions taken in this workspace will appear here." />
        ) : (
          <>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th className="pf-hide-sm">Entity id</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id}>
                      <td>{formatDateTime(e.timestamp)}</td>
                      <td><strong>{e.action}</strong></td>
                      <td>{e.entityTable}</td>
                      <td className="pf-hide-sm">{e.entityId}</td>
                      <td>{e.changedBy === currentUserId ? "You" : `#${String(e.changedBy).slice(-6)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isDone && (
              <div className="pf-form-actions" style={{ marginTop: 12 }}>
                <button type="button" className="secondary-button" onClick={loadMore} disabled={!page.continueCursor}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}