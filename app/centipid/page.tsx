"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserProfile } from "../components/UserProfileContext";
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  KeyRound,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

const eventKinds = [
  { group: "Subscriber lifecycle", events: ["subscriber.created", "subscriber.paused", "subscriber.resumed"] },
  { group: "Payments", events: ["payment.received", "payment.refunded"] },
  { group: "Vouchers", events: ["voucher.generated", "voucher.redeemed"] },
  { group: "Support tickets", events: ["ticket.opened", "ticket.resolved"] },
];

const readOnlyMcpTools = [
  "list_subscribers",
  "payments_report",
  "voucher_stock",
  "open_tickets",
  "revenue_summary",
];

export default function CentipidSettingsPage() {
  const { user } = useUserProfile();
  const isAdmin = user?.permissions?.includes("centipid:manage") ?? false;

  const settings = useQuery(api.centipid.getCentipidSettingsView, {});
  const deliveryLogs = useQuery(api.centipid.getWebhookDeliveryLogs, { limit: 30 });

  const saveCredentials = useMutation(api.centipid.saveCentipidCredentials);
  const setPaused = useMutation(api.centipid.setCentipidIngestionPaused);
  const verifyToken = useAction(api.centipid.verifyCentipidToken);
  const fetchHistorical = useAction(api.centipid.fetchHistoricalCentipidData);

  const [apiToken, setApiToken] = useState("");
  const [webhookSigningSecret, setWebhookSigningSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    setStatusIsError(isError);
  };

  const handleSave = async () => {
    if (!apiToken.trim() || !webhookSigningSecret.trim()) {
      showStatus("Both the API token and webhook signing secret are required.", true);
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    try {
      await saveCredentials({
        apiToken: apiToken.trim(),
        webhookSigningSecret: webhookSigningSecret.trim(),
      });
      setApiToken("");
      setWebhookSigningSecret("");
      showStatus("Credentials saved and encrypted. Live webhook verification is now active.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Could not save credentials.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePaused = async () => {
    setWorking(true);
    setStatusMessage(null);
    try {
      const result = await setPaused({ paused: !settings?.ingestionPaused });
      showStatus(result.paused ? "Ingestion paused. Webhooks are acknowledged but not stored." : "Ingestion resumed.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Could not change ingestion state.", true);
    } finally {
      setWorking(false);
    }
  };

  const handleVerify = async () => {
    setWorking(true);
    setVerifyResult(null);
    setStatusMessage(null);
    try {
      const result = await verifyToken();
      if (result.ok) {
        setVerifyResult(
          `Connected. ${result.toolCount} MCP tools are available${result.probe ? ` — probe: ${result.probe}` : ""}.`,
        );
      } else {
        setVerifyResult(`Not verified — ${result.error ?? "unknown error"}`);
      }
    } catch (error) {
      setVerifyResult(error instanceof Error ? error.message : "Verification input look up failed.");
    } finally {
      setWorking(false);
    }
  };

  const handleBackfill = async () => {
    setWorking(true);
    setBackfillResult(null);
    setStatusMessage(null);
    try {
      const result = await fetchHistorical();
      const lines = result.report
        .map((entry) => `${entry.tool}: ${entry.inserted} stored${entry.error ? ` (${entry.error})` : ""}`)
        .join(" · ");
      setBackfillResult(lines);
    } catch (error) {
      setBackfillResult(error instanceof Error ? error.message : "Historical backfill failed.");
    } finally {
      setWorking(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    if (!settings?.webhookUrl) return;
    void navigator.clipboard.writeText(settings.webhookUrl);
    showStatus("Webhook URL copied to the clipboard.");
  };

  if (user === undefined) {
    return <main className="workspace-page"><div className="workspace-card loading-panel">Loading settings…</div></main>;
  }

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Billing &amp; business</p>
          <h1 className="page-title">Centipid settings</h1>
          <p className="page-subtitle">
            Connect the Centipid billing platform: an MCP API token for read access and a webhook
            signing secret for signed event delivery. Both are encrypted at rest.
          </p>
        </div>
      </div>

      {settings && !settings.encryptionConfigured && settings.hasCredentials && (
        <div className="incident-banner">
          <div>
            <ShieldAlert aria-hidden="true" size={18} />
            <div>
              <strong>Credential encryption key missing</strong>
              <small>
                CENTIPID_CREDENTIALS_ENCRYPTION_KEY is not set. Verified webhook deliveries will fail
                until a 32-byte base64 key is configured in the environment.
              </small>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <p className={`platform-claim-message ${statusIsError ? "" : "ok"}`} role="status">{statusMessage}</p>
      )}

      <div className="operations-kpi-strip">
        <div className="operations-kpi">
          <span>{settings?.hasCredentials ? <CheckCircle2 aria-hidden="true" size={16} /> : <KeyRound aria-hidden="true" size={16} />}</span>
          <p>Connection</p>
          <strong>{settings?.hasCredentials ? "Configured" : "Not configured"}</strong>
          <small>{settings?.ingestionPaused ? "Ingestion is paused." : "Signed webhooks are verified."}</small>
        </div>
        <div className="operations-kpi">
          <span>{settings?.ingestionPaused ? <PauseCircle aria-hidden="true" size={16} /> : <PlayCircle aria-hidden="true" size={16} />}</span>
          <p>Webhook ingestion</p>
          <strong>{settings?.ingestionPaused ? "Paused" : "Live"}</strong>
          <small>{settings?.ingestionPaused ? "Deliveries are acknowledged but skipped." : "Events are stored on delivery."}</small>
        </div>
        <div className="operations-kpi">
          <span><ClipboardCopy aria-hidden="true" size={16} /></span>
          <p>Webhook URL</p>
          <strong style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }} title={settings?.webhookUrl ?? undefined}>
            {settings?.webhookUrl ?? "Configure CONVEX_SITE_URL"}
          </strong>
          <small>
            {settings?.webhookUrl ? (
              <button type="button" className="card-link" onClick={handleCopyWebhookUrl}>Copy to clipboard</button>
            ) : (
              "Set CONVEX_SITE_URL to expose the receiver."
            )}
          </small>
        </div>
        <div className="operations-kpi">
          <span><RefreshCw aria-hidden="true" size={16} /></span>
          <p>Swap subscribers</p>
          <strong>{deliveryLogs === undefined ? "…" : deliveryLogs.filter((log) => log.processed).length}</strong>
          <small>Processed events in the delivery log</small>
        </div>
      </div>

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, .9fr)", gap: 16, alignItems: "start" }}>
        <div className="pf-stack">
          {isAdmin && (
            <section className="pf-panel">
              <h2>Credentials</h2>
              <p className="pf-muted">
                The API token (Bearer key, format <code>12|…</code>) is used by the MCP endpoint and the
                webhook signing secret verifies raw-body HMAC signatures. Both are encrypted with
                AES-GCM before they are stored.
              </p>
              <form
                className="pf-form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
              >
                <div className="pf-field" style={{ gridColumn: "span 2" }}>
                  <label className="pf-label" htmlFor="centipid-token">MCP API token</label>
                  <input
                    id="centipid-token"
                    type="password"
                    autoComplete="off"
                    value={apiToken}
                    onChange={(event) => setApiToken(event.target.value)}
                    placeholder="12|…"
                    className="pf-input"
                  />
                  <span className="pf-hint">Private key from Centipid &gt; Developer &gt; MCP. Stored encrypted.</span>
                </div>
                <div className="pf-field" style={{ gridColumn: "span 2" }}>
                  <label className="pf-label" htmlFor="centipid-secret">Webhook signing secret</label>
                  <input
                    id="centipid-secret"
                    type="password"
                    autoComplete="off"
                    value={webhookSigningSecret}
                    onChange={(event) => setWebhookSigningSecret(event.target.value)}
                    placeholder="Shared HMAC secret"
                    className="pf-input"
                  />
                  <span className="pf-hint">The secret Centipid uses to sign each webhook delivery. Stored encrypted.</span>
                </div>
                <div className="pf-form-actions" style={{ gridColumn: "span 4" }}>
                  <button type="submit" className="primary-button" disabled={saving || working}>
                    {saving ? "Saving…" : "Save credentials"}
                  </button>
                </div>
              </form>

              <div className="pf-form-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                {settings?.hasCredentials && (
                  <button type="button" className="secondary-button" onClick={handleTogglePaused} disabled={working}>
                    {settings.ingestionPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                    {settings.ingestionPaused ? "Resume ingestion" : "Pause ingestion"}
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={handleVerify} disabled={working || !settings?.hasCredentials}>
                  <KeyRound size={16} />
                  Verify token
                </button>
                <button type="button" className="secondary-button" onClick={handleBackfill} disabled={working || !settings?.hasCredentials}>
                  <Download size={16} />
                  Fetch historical snapshot
                </button>
              </div>

              {verifyResult && (
                <p className="dialog-message" style={{ marginTop: 14 }}>{verifyResult}</p>
              )}
              {backfillResult && (
                <p className="dialog-message" style={{ marginTop: 14 }}>{backfillResult}</p>
              )}
            </section>
          )}

          <section className="pf-panel">
            <h2>Wire-up guide</h2>
            <p className="pf-muted">Configure the signed webhook in Centipid&apos;s developer portal.</p>
            {settings?.webhookUrl ? (
              <div className="detail-list" style={{ marginTop: 12 }}>
                <div className="detail-row">
                  <strong>Endpoint</strong>
                  <span>{settings.webhookUrl}</span>
                  <button type="button" className="card-link" onClick={handleCopyWebhookUrl}>Copy</button>
                </div>
              </div>
            ) : (
              <p className="pf-hint" style={{ marginTop: 8 }}>
                Set <code>CONVEX_SITE_URL</code> to your deployment URL so the receiver address can be shown here.
              </p>
            )}

            <p className="detail-section-title">Delivered event types</p>
            <div className="detail-list">
              {eventKinds.map(({ group, events }) => (
                <div key={group} className="detail-row">
                  <strong>{group}</strong>
                  <span>{events.join(", ")}</span>
                </div>
              ))}
            </div>

            <p className="detail-section-title">MCP tools (read access)</p>
            <p className="pf-muted">
              The historical snapshot best-effort reads from these tools, so webhooks stay the source
              of truth. Example tools: {readOnlyMcpTools.join(", ")}.
            </p>
          </section>
        </div>

        <section className="pf-panel" style={{ alignSelf: "start" }}>
          <h2>Webhook deliveries</h2>
          <p className="pf-muted">
            Every delivery to the receiver is logged. Unprocessed rows show why a delivery was accepted
            but not written (capture mode, pause, or unknown event).
          </p>
          {deliveryLogs === undefined ? (
            <p className="pf-hint" style={{ marginTop: 12 }}>Loading delivery records…</p>
          ) : deliveryLogs.length === 0 ? (
            <div className="empty-state">
              <h3>No deliveries yet</h3>
              <p>When Centipid sends its first webhook, it will appear here with its raw signature preview.</p>
            </div>
          ) : (
            <div className="delivery-log-panel" style={{ marginTop: 12, overflowX: "auto" }}>
              <table className="delivery-log-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Signature</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryLogs.map((delivery) => (
                    <tr key={delivery._id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(delivery.receivedAt).toLocaleString()}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{delivery.eventType}</td>
                      <td>
                        <span className={`status-chip ${delivery.signatureValid ? "status-chip-success" : "status-chip-neutral"}`}>
                          {delivery.signatureValid ? "valid" : "n/a"}
                        </span>
                      </td>
                      <td>
                        <span className={`status-chip ${delivery.processed ? "status-chip-success" : delivery.errorMessage ? "status-chip-error" : "status-chip-info"}`}>
                          {delivery.processed ? "stored" : delivery.errorMessage ? "failed" : "queued"}
                        </span>
                        {delivery.errorMessage && (
                          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 }}>{delivery.errorMessage}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pf-hint" style={{ marginTop: 10 }}>
            <ExternalLink size={11} style={{ verticalAlign: -1 }} /> Raw signature headers and body previews are captured for every
            delivery while the provider contract is being pinned.
          </p>
        </section>
      </div>
    </main>
  );
}