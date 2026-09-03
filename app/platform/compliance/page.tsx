"use client";

import { EmptyState } from "../components/ui";

export default function CompliancePage() {
  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Legal & Compliance</h1>
          <p className="page-subtitle">Data protection and retention policy for customer contact data.</p>
        </div>
      </div>

      <div className="pf-stack">
        <div className="pf-panel">
          <h2>Customer Phone Data — Lawful Basis</h2>
          <p className="pf-muted">
            The sole source of customer PII is the phone number captured at voucher redemption
            (<code>customerPhoneAtRedemption</code>). Its lawful basis and handling are documented here.
          </p>

          <h3 style={{ marginTop: 20 }}>Kenya — Data Protection Act 2019</h3>
          <ul className="pf-list">
            <li><strong>Basis:</strong> Legitimate interest — the phone is required to attribute renewal activity to the selling agent and to reconcile against the service provider&apos;s export.</li>
            <li><strong>Collection:</strong> Explicit, at the single point of redemption. No other touchpoint collects customer PII.</li>
            <li><strong>Purpose limitation:</strong> Used only for agent attribution and reconciliation, never for marketing.</li>
            <li><strong>Minimisation:</strong> Only the phone number is stored; no name, address, or other personal fields.</li>
            <li><strong>Retention:</strong> Kept for a defined retention window, then auto-purged (see below).</li>
          </ul>

          <h3 style={{ marginTop: 20 }}>Uganda — OPEN ITEM</h3>
          <p className="pf-hint" style={{ display: "block", marginTop: 8 }}>
            Uganda&apos;s data protection law has <strong>not been confirmed</strong> as equivalent to Kenya&apos;s DPA 2019.
            Before this dataset grows, confirm which law applies for Ugandan markets (UGX) and record it here.
            Do not assume parity.
          </p>
        </div>

        <div className="pf-panel">
          <h2>Retention Policy</h2>
          <table className="pf-table pf-table-compact" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Field</th><th>Retention</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>customerPhoneAtRedemption</code></td>
                <td>12 months past voucher redemption</td>
                <td>Auto-purged by scheduled job after window elapses</td>
              </tr>
              <tr>
                <td>Renewal credits (matched phone linkage)</td>
                <td>24 months past last renewal</td>
                <td>Linked phone anonymised after window</td>
              </tr>
              <tr>
                <td><code>auditLog</code> (financial/audit records)</td>
                <td>Permanent</td>
                <td>Never purged, per MylesCorp records retention rule</td>
              </tr>
              <tr>
                <td>Centipid webhook delivery log</td>
                <td>30 days</td>
                <td>Pruned on schedule</td>
              </tr>
              <tr>
                <td>Health / usage samples</td>
                <td>180 days</td>
                <td>Pruned on schedule (already implemented)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pf-panel">
          <h2>Data Protection Principles Applied</h2>
          <ul className="pf-list">
            <li><strong>Minimisation:</strong> Phone captured at redemption only — never stored elsewhere.</li>
            <li><strong>Purpose limitation:</strong> Used strictly for agent attribution and Centipid reconciliation.</li>
            <li><strong>Retention limits:</strong> Auto-purge job clears PII after the defined window.</li>
            <li><strong>Accountability:</strong> Every PII lifecycle event is written to the unified audit log.</li>
            <li><strong>Secure:</strong> Stored alongside other app data behind platform authentication; never exposed in client-facing read models.</li>
          </ul>
          <p className="pf-hint" style={{ display: "block", marginTop: 12 }}>
            No technical debt: this page and the retention cron are the compliance surface. Keep it current.
          </p>
        </div>
      </div>
    </div>
  );
}
