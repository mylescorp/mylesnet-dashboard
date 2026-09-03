"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field, Select, Loading, EmptyState, formatDateTime } from "../components/ui";

const CONFIG = {
  market: { table: "markets", label: "Markets" },
  device: { table: "devices", label: "Devices" },
  agent: { table: "agents", label: "Agents" },
  voucher: { table: "vouchers", label: "Vouchers" },
  commission: { table: "commissions", label: "Commissions" },
  alert: { table: "alerts", label: "Alerts" },
} as const;

export default function AuditLogPage() {
  const [entityTable, setEntityTable] = useState<string>("");
  const [limit, setLimit] = useState(50);
  const entries = useQuery(
    api.platform.listAuditLog,
    entityTable ? { entityTable, limit } : { limit }
  );
  const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});

  if (entries === undefined || currentUser === undefined) return <Loading />;

  const currentUserId = currentUser && currentUser._id;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">A unified, read-only record of every mutating action, newest first.</p>
        </div>
      </div>

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          <Field label="Filter by entity">
            <Select value={entityTable} onChange={(e) => setEntityTable(e.target.value)}>
              <option value="">All entities</option>
              {Object.values(CONFIG).map((c) => (
                <option key={c.table} value={c.table}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Rows">
            <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="pf-panel">
        {entries.length === 0 ? (
          <EmptyState title="No audit entries" body="Actions taken in the platform will appear here." />
        ) : (
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
        )}
      </div>
    </div>
  );
}
