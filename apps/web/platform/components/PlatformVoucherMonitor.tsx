"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { voucherFraud, type RedemptionMonitorRow } from "@/lib/convex/voucherFraud";

const SIGNAL_LABEL: Record<string, string> = {
  duplicate_code: "Duplicate code",
  velocity: "Velocity",
  geo_anomaly: "Geo anomaly",
};

const canManage = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

export function PlatformVoucherMonitor() {
  const { user } = useUserProfile();
  const rows = useQuery(voucherFraud.monitor, { limit: 50 });
  const flagVoucher = useMutation(voucherFraud.flagVoucher);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = canManage(user?.roles);

  const metrics = useMemo(() => ({
    total: rows?.length ?? 0,
    flagged: rows?.filter((r) => r.fraudFlagStatus === "flagged" || r.signals.length > 0).length ?? 0,
    blocked: rows?.filter((r) => r.fraudFlagStatus === "blocked").length ?? 0,
    clean: rows?.filter((r) => r.fraudFlagStatus === "clean" && r.signals.length === 0).length ?? 0,
  }), [rows]);

  const setFlag = async (row: RedemptionMonitorRow, status: "clean" | "flagged" | "blocked", reason?: string) => {
    setError(null); setNotice(null);
    try {
      await flagVoucher({ voucherId: row._id, fraudFlagStatus: status, reason });
      setNotice(`${row.code} marked ${status}.`);
    } catch (caught) {
      setError(userFacingMessage(caught, "Flag update failed."));
    }
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Voucher redemption monitor</h1>
          <p className="page-subtitle">
            Duplicate, velocity, and geo-anomaly signals computed from redemption records at query time.
          </p>
        </div>
      </header>

      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}

      <section className="metric-grid" aria-label="Redemption monitor summary">
        <Metric label="Recent redemptions" value={metrics.total} detail="last 50 sorted by time" />
        <Metric label="Signals" value={metrics.flagged} detail="records with anomalies" />
        <Metric label="Blocked" value={metrics.blocked} detail="operator-dispositioned" />
        <Metric label="Clean" value={metrics.clean} detail="no signals detected" />
      </section>

      <section className="section-heading"><div><p className="eyebrow">Monitor</p><h2>Redemption signals</h2></div><span className="section-count">{rows?.length ?? 0} shown</span></section>

      {rows === undefined ? (
        <p className="pf-muted">Loading monitor…</p>
      ) : rows.length === 0 ? (
        <div className="tenant-empty-state">
          <ShieldAlert size={26} aria-hidden="true" />
          <h3>No redemptions in view</h3>
          <p>Redeemed vouchers surface here with their anomaly signals.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Tenant</th>
                <th>Market</th>
                <th>Phone</th>
                <th>Device</th>
                <th>IP</th>
                <th>Redeemed</th>
                <th>Signals</th>
                <th>Suggested</th>
                <th>Operator flag</th>
                {editable ? <th className="pf-action-col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main">{row.code}</td>
                  <td>{row.tenantName ?? row.tenantId ?? "—"}</td>
                  <td>{row.marketName ?? row.marketId}</td>
                  <td>{row.customerPhone ?? "—"}</td>
                  <td>{row.redeemedDeviceId ?? "—"}</td>
                  <td>{row.redeemedIpAddress ?? "—"}</td>
                  <td>{row.redeemedAt ? new Date(row.redeemedAt).toLocaleString() : "—"}</td>
                  <td>
                    {row.signals.length === 0 ? (
                      <span className="pf-badge pf-badge-success">Clean</span>
                    ) : (
                      row.signals.map((signal) => (
                        <span key={signal} className="pf-badge pf-badge-danger">{SIGNAL_LABEL[signal] ?? signal}</span>
                      ))
                    )}
                  </td>
                  <td>
                    <span className={`pf-badge pf-badge-${row.suggestedVerdict === "blocked" ? "danger" : row.suggestedVerdict === "flagged" ? "warning" : "success"}`}>
                      {row.suggestedVerdict}
                    </span>
                  </td>
                  <td>
                    {row.fraudFlagStatus === null ? (
                      <span className="pf-muted">Unreviewed</span>
                    ) : (
                      <span className={`pf-badge pf-badge-${row.fraudFlagStatus === "blocked" ? "danger" : row.fraudFlagStatus === "flagged" ? "warning" : "success"}`}>
                        {row.fraudFlagStatus}
                      </span>
                    )}
                  </td>
                  {editable ? (
                    <td className="pf-action-col">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          const next =
                            row.fraudFlagStatus === "blocked" ? "clean"
                              : row.fraudFlagStatus === "flagged" ? "blocked"
                                : row.signals.length > 0 ? "flagged" : "blocked";
                          const reason =
                            next === "flagged" ? `Auto: ${row.signals.join(",")}` : undefined;
                          void setFlag(row, next, reason);
                        }}
                      >
                        {row.fraudFlagStatus === "blocked" ? "Clear" : "Flag"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}
