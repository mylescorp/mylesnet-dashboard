"use client";

import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { useUserProfile } from "../components/UserProfileContext";
import {
  Activity,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardCopy,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Radio,
  RefreshCw,
  ShieldAlert,
  Signal,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

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

const eventMetas: Record<string, { label: string; badge: string; icon: typeof Users }> = {
  subscriber: { label: "Subscriber", badge: "event-badge-subscriber", icon: Users },
  payment: { label: "Payment", badge: "event-badge-payment", icon: CreditCard },
  voucher: { label: "Voucher", badge: "event-badge-voucher", icon: Ticket },
  ticket: { label: "Ticket", badge: "event-badge-ticket", icon: Wrench },
};

const formatMoney = (value: number | null | undefined, currency = "UGX") =>
  value === null || value === undefined ? "—" : `${currency} ${Math.round(value).toLocaleString()}`;

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;

const timeAgo = (timestamp: number, now = Date.now()) => {
  const seconds = Math.max(1, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const staleThresholdMs = 6 * 60 * 60 * 1000;

interface RecentEventShape {
  _id?: string;
  category: string;
  eventType: string;
  timestamp: number;
  phone?: string;
  name?: string;
  packageName?: string;
  centipidSubscriberId?: string;
  currency?: string;
  amount?: number;
  subscriberPhone?: string;
  customerPhone?: string;
  centipidVoucherId?: string;
  subject?: string;
  centipidTicketId?: string;
}

interface WebhookDeliveryShape {
  _id: string;
  receivedAt: number;
  eventType: string;
  signatureValid: boolean;
  processed: boolean;
  errorMessage?: string;
  signatureHeader?: string;
  rawBodyPreview?: string;
}

interface LiveSnapshotResult {
  configured: boolean;
  at: number | null;
  revenueToday?: number | null;
  revenueYesterday?: number | null;
  subscribersOnline?: number | null;
  activeSubscriptions?: number | null;
  expiring24h?: number | null;
  unreconciledPayments?: number | null;
  currency?: string;
  lastAttemptAt: number | null;
  lastAttemptOk: boolean | null;
  lastAttemptError: string | null;
}

const prettyBody = (raw: string | undefined) => {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const describeEvent = (event: RecentEventShape) => {
  switch (event.category) {
    case "subscriber":
      return [event.phone, event.name, event.packageName].filter(Boolean).join(" · ") || event.centipidSubscriberId || "Subscriber event";
    case "payment":
      return `${event.currency} ${Math.round(event.amount ?? 0).toLocaleString()}${event.subscriberPhone ? ` · ${event.subscriberPhone}` : ""}`;
    case "voucher":
      return [event.packageName, event.customerPhone].filter(Boolean).join(" · ") || event.centipidVoucherId || "Voucher event";
    case "ticket":
      return event.subject || event.centipidTicketId || "Ticket event";
    default:
      return event.eventType;
  }
};

export default function CentipidSettingsPage() {
  const { user } = useUserProfile();
  const isAdmin = user?.permissions?.includes("centipid:manage") ?? false;

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const settings = useQuery(api.centipid.getCentipidSettingsView, {});
  const deliveryLogs = useQuery(api.centipid.getWebhookDeliveryLogs, { limit: 30 });
  const summary = useQuery(api.centipid.getCentipidBusinessSummary, { tzOffsetMinutes });
  const recentEvents = useQuery(api.centipid.getRecentAllEvents, { limit: 8 });
  const operationsKpis = useQuery(api.operations.getKpis, {});

  const saveCredentials = useMutation(api.centipid.saveCentipidCredentials);
  const removeCredentials = useMutation(api.centipid.removeCentipidCredentials);
  const setPaused = useMutation(api.centipid.setCentipidIngestionPaused);
  const verifyToken = useAction(api.centipid.verifyCentipidToken);
  const fetchHistorical = useAction(api.centipid.fetchHistoricalCentipidData);
  const syncLiveSnapshot = useAction(api.centipid.syncCentipidLiveSnapshot);
  const liveSnapshot = useQuery(api.centipid.getCentipidLiveSnapshot, isAdmin ? {} : "skip") as LiveSnapshotResult | undefined;

  const [apiToken, setApiToken] = useState("");
  const [webhookSigningSecret, setWebhookSigningSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingCredentials, setRemovingCredentials] = useState(false);
  const [showRemoveCredentials, setShowRemoveCredentials] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<"centipid" | "all">("centipid");
  const [autoSyncingLive, setAutoSyncingLive] = useState(false);
  const lastAutoSyncAt = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // A newly opened page should not wait for the first scheduled collector run.
  // Once stored, the Convex query above pushes all later collector updates.
  useEffect(() => {
    if (!isAdmin || !settings?.hasCredentials || liveSnapshot === undefined) return;
    const snapshotAge = liveSnapshot.at === null ? Number.POSITIVE_INFINITY : Date.now() - liveSnapshot.at;
    if (snapshotAge < 30_000 || Date.now() - lastAutoSyncAt.current < 30_000) return;
    lastAutoSyncAt.current = Date.now();
    setAutoSyncingLive(true);
    void syncLiveSnapshot().finally(() => setAutoSyncingLive(false));
  }, [isAdmin, liveSnapshot, settings?.hasCredentials, syncLiveSnapshot]);

  const lastDelivery = deliveryLogs && deliveryLogs.length > 0 ? deliveryLogs[0].receivedAt : null;
  const latestDeliveryAt = settings?.latestDeliveryAt ?? lastDelivery;
  const lastDeliveryAge = latestDeliveryAt === null ? null : now - latestDeliveryAt;
  const isWorkosRow = (delivery: WebhookDeliveryShape) => delivery.eventType.startsWith("workos.");
  const visibleDeliveries = useMemo(
    () => (deliveryLogs ?? []).filter((delivery: WebhookDeliveryShape) => deliveryFilter === "all" || !isWorkosRow(delivery)),
    [deliveryLogs, deliveryFilter],
  );
  const stale = settings !== undefined
    && settings.hasCredentials
    && !settings.ingestionPaused
    && lastDeliveryAge !== null
    && lastDeliveryAge > staleThresholdMs;
  // Convex can briefly serve the previous query result shape during a rolling
  // function deployment. Keep the live page usable until the new projection
  // is available instead of dereferencing an absent optional field.
  const platformSnapshot = summary?.platformSnapshot;
  // `getCentipidLiveSnapshot` is the canonical persisted MCP projection. The
  // business summary is a convenience aggregate and can briefly be served
  // with its older shape during a rolling Convex function deployment.
  const currentSnapshot = liveSnapshot?.at ? liveSnapshot : platformSnapshot;
  // Centipid's configured MCP tools do not currently emit a live-session
  // field. RouterOS is the authoritative source for the connected-session
  // count, and its Convex query is live just like the MCP projection.
  const routerSessionCount = operationsKpis?.collectorConnected ? operationsKpis.totalUsers : undefined;
  const subscribersOnline = currentSnapshot?.subscribersOnline ?? routerSessionCount;
  const subscribersOnlineSource = currentSnapshot?.subscribersOnline !== null && currentSnapshot?.subscribersOnline !== undefined
    ? "Current network presence from Centipid"
    : operationsKpis?.collectorConnected
      ? "Current hotspot sessions from RouterOS"
      : "Awaiting RouterOS collector connectivity";

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    setStatusIsError(isError);
  };

  const handleSave = async () => {
    const hasExisting = !!settings?.hasCredentials;
    const token = apiToken.trim();
    const secret = webhookSigningSecret.trim();
    if (!hasExisting) {
      if (!token || !secret) {
        showStatus("Both the API token and webhook signing secret are required for initial setup.", true);
        return;
      }
    } else if (!token && !secret) {
      showStatus("Enter a new API token, a new webhook signing secret, or both to update credentials.", true);
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    try {
      const payload: { apiToken?: string; webhookSigningSecret?: string } = {};
      if (token) payload.apiToken = token;
      if (secret) payload.webhookSigningSecret = secret;
      await saveCredentials(payload);
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

  const handleRemoveCredentials = async () => {
    if (removeConfirmation !== "REMOVE") return;
    setRemovingCredentials(true);
    setStatusMessage(null);
    try {
      const result = await removeCredentials({ confirmation: removeConfirmation });
      if (result.removed) {
        setApiToken("");
        setWebhookSigningSecret("");
        setRemoveConfirmation("");
        setShowRemoveCredentials(false);
        showStatus("Centipid credentials removed. Historical events are retained; add new credentials to reconnect.");
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Could not remove Centipid credentials.", true);
    } finally {
      setRemovingCredentials(false);
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
      const result = await fetchHistorical() as { report: Array<{ tool: string; inserted: number; error?: string }> };
      const lines = result.report
        .map((entry: { tool: string; inserted: number; error?: string }) => `${entry.tool}: ${entry.inserted} stored${entry.error ? ` (${entry.error})` : ""}`)
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

  const toggleDelivery = (id: string) => {
    setExpandedDelivery((current) => (current === id ? null : id));
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showStatus(`${label} copied to the clipboard.`);
  };

  if (user === undefined) {
    return <main className="workspace-page centipid-page"><div className="workspace-card loading-panel">Loading settings…</div></main>;
  }

  const heroContext = settings === undefined
    ? { dot: "status-dot-neutral", title: "Checking integration…", sub: "Loading the current connection state." }
    : !settings.hasCredentials
      ? { dot: "status-dot-danger", title: "Awaiting credentials", sub: "Add your MCP API token and webhook signing secret to start streaming business events." }
      : settings.ingestionPaused
        ? { dot: "status-dot-warning", title: "Connected, ingestion paused", sub: "Signed webhooks are verified and encrypted — deliveries are currently acknowledged but not stored." }
        : { dot: "status-dot-online", title: "Connected to Centipid", sub: "Signed webhooks are verified and stored live — aggregated in the platform activity below." };

  return (
    <main className="workspace-page centipid-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Billing &amp; business</p>
          <h1 className="page-title">Centipid integration</h1>
          <p className="page-subtitle">
            The single control point for this dashboard&apos;s connection to the Centipid billing
            platform — MCP read access, signed webhook ingestion, and live business activity pooled
            from the platform.
          </p>
        </div>
        <div className="page-action-group">
          <Link href="/business-activity" className="secondary-button">
            <Activity size={16} />
            Business activity
          </Link>
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

      {settings?.hasCredentials && settings.lastHealthCheckOk === false && (
        <div className="incident-banner">
          <div>
            <ShieldAlert aria-hidden="true" size={18} />
            <div>
              <strong>Automated token check failed</strong>
              <small>
                The daily health check could not reach the MCP endpoint with the stored key{settings.lastHealthCheckError ? ` — ${settings.lastHealthCheckError}` : ""}.
                Run Verify token below to re-confirm, or rotate the token.
              </small>
            </div>
          </div>
        </div>
      )}

      {stale && (
        <div className="incident-banner">
          <div>
            <CircleDot aria-hidden="true" size={18} />
            <div>
              <strong>No webhook deliveries for {latestDeliveryAt === null ? "a while" : timeAgo(latestDeliveryAt, now)}</strong>
              <small>
                Centipid may have stopped sending events. Run Verify token to confirm the key is
                still valid, then check the delivery log below for the last recorded state.
              </small>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <p className={`platform-claim-message ${statusIsError ? "" : "ok"}`} role="status">{statusMessage}</p>
      )}

      <section className="centipid-hero-card" aria-label="Integration status">
        <div className="centipid-hero-main">
          <span className={`status-dot ${heroContext.dot}`} aria-hidden="true" />
          <div>
            <p className="centipid-hero-kicker">Integration status</p>
            <h2>{heroContext.title}</h2>
            <p className="centipid-hero-sub">{heroContext.sub}</p>
          </div>
        </div>
        <div className="centipid-hero-stats">
          <div>
            <span>Credentials</span>
            <strong>{settings?.hasCredentials ? "Configured" : "Not configured"}</strong>
          </div>
          <div>
            <span>Ingestion</span>
            <strong>{settings?.ingestionPaused ? "Paused" : "Live"}</strong>
          </div>
          <div>
            <span>Last webhook</span>
            <strong>{latestDeliveryAt ? timeAgo(latestDeliveryAt, now) : "None yet"}</strong>
          </div>
          <div>
            <span>Health check</span>
            <strong
              className={
                settings?.lastHealthCheckOk === false
                  ? "centipid-health-failed"
                  : settings?.lastHealthCheckOk
                    ? "centipid-health-ok"
                    : undefined
              }
            >
              {settings === undefined
                ? "…"
                : !settings.hasCredentials
                  ? "Not set"
                  : settings.lastHealthCheckAt === null
                    ? "Pending"
                    : settings.lastHealthCheckOk
                      ? `OK · ${timeAgo(settings.lastHealthCheckAt, now)}`
                      : "Failed"}
            </strong>
          </div>
        </div>
      </section>

      <section aria-label="Live platform activity">
        <div className="centipid-section-head">
          <div>
            <p className="eyebrow">Pooled from Centipid</p>
            <h2>Live platform activity</h2>
            <p>Reconciled from signed webhooks and read-only Centipid MCP data · updates automatically every 30 seconds.</p>
          </div>
          <div className="centipid-section-head-right">
            <span className="status-chip status-chip-success">
              <CircleDot size={12} className="pulse-dot" />
              {currentSnapshot?.at ? `Synced ${timeAgo(currentSnapshot.at, now)}` : "Live feed"}
            </span>
          </div>
        </div>
        <div className="operations-kpi-strip kpi-strip-live">
          <div className="operations-kpi">
            <span><CreditCard aria-hidden="true" size={17} /></span>
            <p>Payments today</p>
            <strong>{summary?.today.paymentCount ?? "—"}</strong>
            <small>
              {summary ? `Avg ${formatMoney(summary.today.averagePayment)} · 7d: ${summary.last7d.paymentCount}` : "Waiting for data."}
            </small>
          </div>
          <div className="operations-kpi">
            <span><ArrowDownToLine aria-hidden="true" size={17} /></span>
            <p>Collected today</p>
            <strong>{summary?.revenueVisible ? formatMoney(currentSnapshot?.revenueToday ?? summary.today.net) : "—"}</strong>
            <small>
              {summary && !summary.revenueVisible
                ? "Visible to admins only."
                : summary
                  ? currentSnapshot?.revenueToday !== null && currentSnapshot?.revenueToday !== undefined
                    ? "Current Centipid platform total"
                    : `Net of refunds · 7d: ${formatMoney(summary.last7d.net)}`
                  : "Waiting for data."}
            </small>
          </div>
          <div className="operations-kpi">
            <span><UserPlus aria-hidden="true" size={17} /></span>
            <p>New subscribers</p>
            <strong>{summary?.today.subscriberCreated ?? "—"}</strong>
            <small>
              {summary ? `Paused: ${summary.today.subscriberPaused} · Resumed: ${summary.today.subscriberResumed}` : "Waiting for data."}
            </small>
          </div>
          <div className="operations-kpi">
            <span><Ticket aria-hidden="true" size={17} /></span>
            <p>Vouchers redeemed</p>
            <strong>{summary?.today.vouchersRedeemed ?? "—"}</strong>
            <small>
              {summary
                ? `Generated: ${summary.today.vouchersGenerated} · Redemption ${formatPercent(summary.today.redemptionRate)}`
                : "Waiting for data."}
            </small>
          </div>
          <div className="operations-kpi">
            <span><PauseCircle aria-hidden="true" size={17} /></span>
            <p>Paused right now</p>
            <strong>{summary?.live.pausedSubscribers ?? "—"}</strong>
            <small>Subscribers with an active pause</small>
          </div>
          <div className="operations-kpi">
            <span><Wrench aria-hidden="true" size={17} /></span>
            <p>Open tickets</p>
            <strong>{summary?.live.openTickets ?? "—"}</strong>
            <small>
              {summary
                ? `Opened today: ${summary.today.ticketsOpened} · Resolved: ${summary.today.ticketsResolved}`
                : "Waiting for data."}
            </small>
          </div>
          <div className="operations-kpi">
            <span><Signal aria-hidden="true" size={17} /></span>
            <p>Subscribers online</p>
            <strong>{subscribersOnline?.toLocaleString() ?? "—"}</strong>
            <small>{subscribersOnlineSource}</small>
          </div>
          <div className="operations-kpi">
            <span><Clock3 aria-hidden="true" size={17} /></span>
            <p>Expiring in 24h</p>
            <strong>{currentSnapshot?.expiring24h?.toLocaleString() ?? "—"}</strong>
            <small>Renewals due before tomorrow</small>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section aria-label="Platform snapshot">
          <div className="centipid-section-head">
            <div>
              <p className="eyebrow">MCP read access</p>
              <h2>Platform snapshot</h2>
              <p>
                Live figures read straight from the Centipid <code>revenue_summary</code> tool over
                the MCP endpoint — independent of pooled webhooks.
              </p>
            </div>
            <div className="centipid-section-head-right">
              {liveSnapshot?.at && (
                <span className={`status-chip ${liveSnapshot.lastAttemptOk === false ? "status-chip-error" : "status-chip-success"}`}>
                  {liveSnapshot.lastAttemptOk === false
                    ? `Last sync failed · showing ${timeAgo(liveSnapshot.at, now)}`
                    : `Synced ${timeAgo(liveSnapshot.at, now)}`}
                </span>
              )}
              <span className="status-chip status-chip-info">
                <CircleDot size={12} className={autoSyncingLive ? "pulse-dot" : undefined} />
                {autoSyncingLive ? "Syncing…" : "Auto-sync · 30s"}
              </span>
            </div>
          </div>

          {!settings?.hasCredentials ? (
            <div className="empty-state">
              <h3>Configure credentials first</h3>
              <p>Add the MCP API token in the credentials panel before pulling a live snapshot.</p>
            </div>
          ) : liveSnapshot === undefined || liveSnapshot.at === null ? (
            <div className="empty-state">
              <h3>Starting automatic sync</h3>
              <p>Centipid&apos;s MCP overview is being collected automatically and will appear here without a manual refresh.</p>
            </div>
          ) : (
            <>
              {liveSnapshot.lastAttemptOk === false && (
                <p className="result-message result-message-error">
                  The latest automatic MCP sync failed — {liveSnapshot.lastAttemptError ?? "unknown error"}. Showing the last successful snapshot.
                </p>
              )}
              <div className="operations-kpi-strip kpi-strip-5">
                <div className="operations-kpi">
                  <span><Signal aria-hidden="true" size={17} /></span>
                  <p>Subscribers online</p>
                  <strong>{subscribersOnline?.toLocaleString() ?? "—"}</strong>
                  <small>{subscribersOnlineSource}</small>
                </div>
                <div className="operations-kpi">
                  <span><Radio aria-hidden="true" size={17} /></span>
                  <p>Active subscriptions</p>
                  <strong>{liveSnapshot.activeSubscriptions?.toLocaleString() ?? "—"}</strong>
                  <small>Subscriptions with an unexpired plan</small>
                </div>
                <div className="operations-kpi">
                  <span><Clock3 aria-hidden="true" size={17} /></span>
                  <p>Expiring in 24h</p>
                  <strong>{liveSnapshot.expiring24h?.toLocaleString() ?? "—"}</strong>
                  <small>Renewals due before this time tomorrow</small>
                </div>
                <div className="operations-kpi">
                  <span><Wallet aria-hidden="true" size={17} /></span>
                  <p>Unreconciled payments</p>
                  <strong>{liveSnapshot.unreconciledPayments?.toLocaleString() ?? "—"}</strong>
                  <small>Payments not yet matched to an invoice</small>
                </div>
                <div className="operations-kpi">
                  <span><ArrowDownToLine aria-hidden="true" size={17} /></span>
                  <p>Revenue today</p>
                  <strong>
                    {summary?.revenueVisible
                      ? formatMoney(liveSnapshot.revenueToday, liveSnapshot.currency ?? "UGX")
                      : "—"}
                  </strong>
                  <small>
                    {summary?.revenueVisible
                      ? `Yesterday: ${formatMoney(liveSnapshot.revenueYesterday, liveSnapshot.currency ?? "UGX")}`
                      : "Visible to admins only."}
                  </small>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section aria-label="Latest webhook events">
        <div className="centipid-section-head">
          <div>
            <p className="eyebrow">Live event stream</p>
            <h2>Latest webhook events</h2>
            <p>
              The most recent subscriber, payment, voucher and ticket events pooled from the
              platform — updated as signed webhooks arrive.
            </p>
          </div>
          <div className="centipid-section-head-right">
            {recentEvents && recentEvents.length > 0 && (
              <span className="status-chip status-chip-success">
                <CircleDot size={12} className="pulse-dot" />
                Live feed
              </span>
            )}
            <Link href="/business-activity" className="card-link">View all</Link>
          </div>
        </div>

        <div className="pf-panel">
          {recentEvents === undefined ? (
            <p className="pf-hint" style={{ margin: "12px 0 0" }}>Loading events…</p>
          ) : recentEvents.length === 0 ? (
            <div className="empty-state">
              <h3>No events yet</h3>
              <p>Business events will stream in here once Centipid starts delivering signed webhooks.</p>
            </div>
          ) : (
            <>
              <div className="event-stream">
                {recentEvents.map((event: RecentEventShape) => {
                  const meta = eventMetas[event.category] ?? { label: "Event", badge: "event-badge-neutral", icon: RefreshCw };
                  const Icon = meta.icon;
                  return (
                    <div key={event._id} className="event-stream-card">
                      <span className={`event-stream-icon ${meta.badge}`}><Icon aria-hidden="true" size={15} /></span>
                      <div className="event-stream-body">
                        <p className="event-stream-title">
                          <span className={`event-badge ${meta.badge}`}>{event.eventType}</span>
                          <time>{timeAgo(event.timestamp, now)}</time>
                        </p>
                        <p className="event-stream-desc">{describeEvent(event)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="pf-hint" style={{ marginTop: 12 }}>
                Showing the {recentEvents.length} most recent events across subscriber, payment,
                voucher and ticket categories — head to Business activity for the full history.
              </p>
            </>
          )}
        </div>
      </section>

      <section aria-label="Webhook deliveries">
        <div className="centipid-section-head">
          <div>
            <p className="eyebrow">Delivery log</p>
            <h2>Webhook deliveries</h2>
            <p>
              Every delivery to the receiver is logged. Unprocessed rows show why a delivery was
              accepted but not written (capture mode, pause, or unknown event).
            </p>
          </div>
          <div className="centipid-section-head-right">
            <div className="filter-tabs" role="tablist" aria-label="Filter deliveries">
              <button
                type="button"
                role="tab"
                aria-selected={deliveryFilter === "centipid"}
                onClick={() => setDeliveryFilter("centipid")}
                className={`filter-tab ${deliveryFilter === "centipid" ? "filter-tab-active" : ""}`}
              >
                Centipid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={deliveryFilter === "all"}
                onClick={() => setDeliveryFilter("all")}
                className={`filter-tab ${deliveryFilter === "all" ? "filter-tab-active" : ""}`}
              >
                All
              </button>
            </div>
            {visibleDeliveries.length > 0 && (
              <span className="status-chip status-chip-neutral">{visibleDeliveries.length} logged</span>
            )}
          </div>
        </div>

        <div className="pf-panel">
          {deliveryLogs === undefined ? (
            <p className="pf-hint" style={{ margin: "12px 0 0" }}>Loading delivery records…</p>
          ) : visibleDeliveries.length === 0 ? (
            deliveryLogs.length === 0 ? (
              <div className="empty-state">
                <h3>No deliveries yet</h3>
                <p>When Centipid sends its first webhook, it will appear here with its raw signature preview.</p>
              </div>
            ) : (
              <div className="empty-state">
                <h3>No Centipid deliveries in the recent log</h3>
                <p>Switch to “All” to inspect deliveries from other receivers (for example WorkOS).</p>
              </div>
            )
          ) : (
            <>
              <div className="pf-table-wrap" style={{ marginTop: 12 }}>
                <table className="pf-table delivery-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>Signature</th>
                      <th>State</th>
                      <th>Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDeliveries.map((delivery: WebhookDeliveryShape) => {
                      const signatureHeader = delivery.signatureHeader;
                      const rawBody = delivery.rawBodyPreview;
                      const expanded = expandedDelivery === delivery._id;
                      return (
                        <Fragment key={delivery._id}>
                          <tr>
                            <td style={{ whiteSpace: "nowrap" }}>{new Date(delivery.receivedAt).toLocaleString()}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{delivery.eventType}</td>
                            <td>
                              <span className={`status-chip ${delivery.signatureValid ? "status-chip-success" : "status-chip-neutral"}`}>
                                {delivery.signatureValid ? "valid" : "n/a"}
                              </span>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <span className={`status-chip ${delivery.processed ? "status-chip-success" : delivery.errorMessage ? "status-chip-error" : "status-chip-info"}`}>
                                {delivery.processed ? "stored" : delivery.errorMessage ? "failed" : "queued"}
                              </span>
                              {delivery.errorMessage && (
                                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 }}>{delivery.errorMessage}</p>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`delivery-expand-btn ${expanded ? "open" : ""}`}
                                onClick={() => toggleDelivery(delivery._id)}
                                aria-expanded={expanded}
                                aria-label="Show raw signature header and body preview"
                                title="Show signature header and body preview"
                              >
                                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${delivery._id}-detail`} className="delivery-detail-row">
                              <td colSpan={5}>
                                <div className="delivery-detail">
                                  <div className="delivery-detail-block">
                                    <p className="delivery-detail-label">
                                      Signature header
                                      {signatureHeader && (
                                        <button type="button" className="card-link" onClick={() => copyText(signatureHeader, "Signature header")}>
                                          <ClipboardCopy size={12} />
                                          Copy
                                        </button>
                                      )}
                                    </p>
                                    <code className="delivery-code">{signatureHeader ?? "Not captured"}</code>
                                  </div>
                                  <div className="delivery-detail-block">
                                    <p className="delivery-detail-label">
                                      Body preview
                                      {rawBody && (
                                        <button type="button" className="card-link" onClick={() => copyText(rawBody, "Body preview")}>
                                          <ClipboardCopy size={12} />
                                          Copy
                                        </button>
                                      )}
                                    </p>
                                    <pre className="delivery-pre">{prettyBody(rawBody) ?? "Not captured"}</pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="pf-hint delivery-prem" style={{ marginTop: 10 }}>
                <ExternalLink size={11} />
                Raw signature headers and body previews are captured for every delivery while the
                provider contract is being pinned.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="settings-grid config-grid">
        <div className="pf-stack">
          {isAdmin && (
            <section className="pf-panel">
              <div className="pf-panel-head">
                <h2>Credentials</h2>
                <span className={`status-chip ${settings?.hasCredentials ? "status-chip-success" : "status-chip-neutral"}`}>
                  {settings?.hasCredentials ? "Configured" : "Not configured"}
                </span>
              </div>
              <p className="pf-muted">
                The MCP API token (Bearer key, format <code>12|…</code>) authenticates the read endpoint,
                and the webhook signing secret verifies each delivery&apos;s raw-body HMAC signature.
                Both are encrypted with AES-GCM before they are stored.{" "}
                {settings?.hasCredentials
                  ? "Leave a field blank to keep its current value — handy for rotating one key without retyping the other."
                  : "Both fields are required for the first-time setup."}
              </p>
              {settings?.hasCredentials && settings.credentialUpdatedAt && (
                <p className="pf-hint">Current credentials were last changed {new Date(settings.credentialUpdatedAt).toLocaleString()}.</p>
              )}
              <form
                className="pf-form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
              >
                <div className="pf-field">
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
                <div className="pf-field">
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
                <div className="pf-actions">
                  <button type="submit" className="primary-button" disabled={saving || working}>
                    {saving ? "Saving…" : settings?.hasCredentials ? "Update credentials" : "Connect Centipid"}
                  </button>
                </div>
              </form>

              {settings?.hasCredentials && (
                <>
                  <div className="pf-divider" />
                  <p className="pf-subheading">Diagnostics &amp; recovery</p>
                  <div className="pf-actions">
                    <button type="button" className="secondary-button" onClick={handleTogglePaused} disabled={working}>
                      {settings.ingestionPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                      {settings.ingestionPaused ? "Resume ingestion" : "Pause ingestion"}
                    </button>
                    <button type="button" className="secondary-button" onClick={handleVerify} disabled={working}>
                      <KeyRound size={16} />
                      Verify token
                    </button>
                    <button type="button" className="secondary-button" onClick={handleBackfill} disabled={working}>
                      <Download size={16} />
                      Fetch snapshot
                    </button>
                    <button type="button" className="secondary-button access-danger-button" onClick={() => setShowRemoveCredentials(true)} disabled={working || removingCredentials}>
                      <Trash2 size={16} />
                      Remove credentials
                    </button>
                  </div>
                  {showRemoveCredentials && (
                    <div className="modal-section" role="alert">
                      <div className="modal-section-head">
                        <div>
                          <p className="pf-label">Remove Centipid credentials</p>
                          <p className="pf-hint">This stops MCP reads and webhook verification immediately. Historical events and audit history remain. Type <code>REMOVE</code> to confirm.</p>
                        </div>
                      </div>
                      <input className="pf-input" value={removeConfirmation} onChange={(event) => setRemoveConfirmation(event.target.value)} aria-label="Confirm credential removal" placeholder="Type REMOVE" autoComplete="off" />
                      <div className="pf-actions">
                        <button type="button" className="secondary-button" onClick={() => { setShowRemoveCredentials(false); setRemoveConfirmation(""); }} disabled={removingCredentials}>Cancel</button>
                        <button type="button" className="danger-button" onClick={handleRemoveCredentials} disabled={removingCredentials || removeConfirmation !== "REMOVE"}>{removingCredentials ? "Removing…" : "Permanently remove credentials"}</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {verifyResult && (
                <p className={`result-message ${verifyResult.startsWith("Connected.") ? "result-message-ok" : "result-message-error"}`}>
                  {verifyResult}
                </p>
              )}
              {backfillResult && (
                <p className="result-message">{backfillResult}</p>
              )}
            </section>
          )}

          <section className="pf-panel">
            <div className="pf-panel-head">
              <h2>Integration guide</h2>
            </div>
            <p className="pf-muted">Configure the signed webhook in Centipid&apos;s developer portal.</p>

            <p className="detail-section-title">Webhook endpoint</p>
            {settings?.webhookUrl ? (
              <div className="detail-list">
                <div className="detail-row">
                  <strong>Endpoint</strong>
                  <span>{settings.webhookUrl}</span>
                  <button type="button" className="card-link" onClick={handleCopyWebhookUrl}>
                    <ClipboardCopy size={12} />
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <p className="pf-hint" style={{ marginTop: 6 }}>
                Set <code>CONVEX_SITE_URL</code> to your deployment URL so the receiver address can be shown here.
              </p>
            )}

            <p className="detail-section-title">Delivered event types</p>
            <div className="detail-list">
              {eventKinds.map(({ group, events }) => (
                <div key={group} className="guide-block">
                  <strong>{group}</strong>
                  <div className="chip-grid">
                    {events.map((event) => (
                      <span key={event} className="event-badge event-badge-neutral">{event}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="detail-section-title">MCP tools (read access)</p>
            <div className="guide-block">
              <div className="chip-grid">
                {readOnlyMcpTools.map((tool) => (
                  <span key={tool} className="role-chip role-chip-muted">{tool}</span>
                ))}
              </div>
            </div>
            <p className="pf-hint" style={{ marginTop: 8 }}>
              The historical snapshot best-effort reads from these tools, so webhooks stay the source
              of truth.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

