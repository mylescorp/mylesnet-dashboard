import process from "node:process";

const runOnceMode = process.argv.includes("--once");

const requiredEnvironment = [
  "MYLESNET_COLLECTOR_ROUTER_ID",
  "MYLESNET_COLLECTOR_INGEST_URL",
  "MYLESNET_COLLECTOR_SHARED_SECRET",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`${name} must be configured before starting the collector.`);
  }
}

const routerId = process.env.MYLESNET_COLLECTOR_ROUTER_ID;
const ingestUrl = process.env.MYLESNET_COLLECTOR_INGEST_URL;
const sharedSecret = process.env.MYLESNET_COLLECTOR_SHARED_SECRET;
const intervalMilliseconds = Number(process.env.MYLESNET_COLLECTOR_INTERVAL_MS ?? "15000");

const PROCESS_UPSTART_AT = Date.now();
const CONFIG_REFRESH_MS = 60_000;
const BACKOFF_CAP_MS = 10 * 60 * 1000;

let parsedIngestUrl;
try {
  parsedIngestUrl = new URL(ingestUrl);
} catch {
  throw new Error("MYLESNET_COLLECTOR_INGEST_URL must be a valid HTTPS URL.");
}

if (parsedIngestUrl.protocol !== "https:") {
  throw new Error("MYLESNET_COLLECTOR_INGEST_URL must use HTTPS.");
}

if (!["/collector/ingest", "/collector/ingest/"].includes(parsedIngestUrl.pathname)) {
  throw new Error("MYLESNET_COLLECTOR_INGEST_URL must target the collector ingestion endpoint.");
}

if (!Number.isSafeInteger(intervalMilliseconds) || intervalMilliseconds < 5000) {
  throw new Error("MYLESNET_COLLECTOR_INTERVAL_MS must be an integer of at least 5000.");
}

function asRecords(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value] : [];
}

function numberValue(record, property) {
  const value = Number(record[property]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function stringValue(record, property) {
  const value = record[property];
  return typeof value === "string" ? value : "";
}

function booleanValue(record, property) {
  return stringValue(record, property) === "true";
}

function leadingNumberValue(record, property) {
  const value = record[property];
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Converts RouterOS relative durations like "1d2h3m4s" to milliseconds. */
function millisecondsFromDuration(value) {
  if (typeof value !== "string") return undefined;
  const units = {
    w: 7 * 24 * 3600e3,
    d: 24 * 3600e3,
    h: 3600e3,
    m: 60e3,
    s: 1e3,
  };
  let total = 0;
  for (const [unit, multiplier] of Object.entries(units)) {
    const match = value.match(new RegExp(`(\\d+(?:\\.\\d+)?)${unit}`));
    if (match) total += Number(match[1]) * multiplier;
  }
  return total > 0 ? total : undefined;
}

/** Converts RouterOS bandwidth strings like "30M", "512k", or "1.5M/1.5M" to bps. */
function parseBandwidthBps(value) {
  if (typeof value !== "string") return undefined;
  const multipliers = { "": 1, k: 1024, K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
  let best;
  for (const part of value.split("/")) {
    const match = part.trim().match(/^(\d+(?:\.\d+)?)\s*([kKM]?)$/);
    if (!match) continue;
    const converted = Number(match[1]) * (multipliers[match[2]] ?? 1);
    if (best === undefined || converted > best) best = converted;
  }
  return best;
}

/** Converts RouterOS link speed strings like "1Gbps" or "100Mbps" to Mbps. */
function parseSpeedMbps(value) {
  if (typeof value !== "string") return undefined;
  const match = value.match(/(\d+)\s*([kKM]?)bps?/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  if (match[2].toUpperCase() === "G") return amount * 1000;
  if (match[2].toUpperCase() === "K") return Math.round(amount / 1000);
  return amount;
}

let connection = null;
let configVersion = null;
let lastConfigFetchAt = 0;
let consecutiveFailures = 0;
let timer = null;
let shuttingDown = false;

if (String(process.env.MYLESNET_COLLECTOR_TLS_SKIP_VERIFY ?? "") === "1") {
  // RouterOS www-ssl commonly ships a self-signed certificate. Opt into skipping
  // TLS verification for the router connection only when explicitly requested.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function fetchFromDashboard(path, init) {
  let response;
  try {
    response = await fetch(new URL(path, ingestUrl), init);
  } catch {
    throw new Error("The collector could not reach the dashboard service.");
  }
  return response;
}

async function loadConnection({ force = false } = {}) {
  if (!force && connection && Date.now() - lastConfigFetchAt < CONFIG_REFRESH_MS) return;
  const configurationUrl = new URL("/collector/config", ingestUrl);
  configurationUrl.searchParams.set("routerId", routerId);
  const response = await fetchFromDashboard(configurationUrl, {
    headers: { "x-mylesnet-collector-secret": sharedSecret },
  });
  if (!response.ok) {
    throw new Error("The collector could not load the configured router connection.");
  }
  const payload = await response.json();
  const nextConnection = payload?.connection;
  if (
    !nextConnection ||
    typeof nextConnection.restBaseUrl !== "string" ||
    typeof nextConnection.username !== "string" ||
    typeof nextConnection.password !== "string"
  ) {
    throw new Error("The collector received an invalid router connection.");
  }
  connection = nextConnection;
  configVersion = typeof payload?.configVersion === "string" ? payload.configVersion : null;
  lastConfigFetchAt = Date.now();
}

async function readRouter(path) {
  const authorization = `Basic ${Buffer.from(`${connection.username}:${connection.password}`).toString("base64")}`;
  let response;
  try {
    response = await fetch(new URL(`/rest${path}`, connection.restBaseUrl), {
      headers: { Accept: "application/json", Authorization: authorization },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause && typeof error.cause.code === "string"
      ? ` (${error.cause.code})`
      : "";
    throw networkError(`The collector could not reach the router REST service${code}.`);
  }
  if (!response.ok) {
    const error = new Error(`Router request failed for ${path}.`);
    error.statusCode = response.status;
    throw error;
  }
  return asRecords(await response.json());
}

function networkError(message) {
  const error = new Error(message);
  error.network = true;
  return error;
}

function normalizeInterfaces(interfaces) {
  return interfaces.map((item) => ({
    name: stringValue(item, "name"),
    running: booleanValue(item, "running"),
    txBytes: numberValue(item, "tx-byte"),
    rxBytes: numberValue(item, "rx-byte"),
    txErrors: numberValue(item, "tx-error"),
    rxErrors: numberValue(item, "rx-error"),
    txDrops: numberValue(item, "tx-drop"),
    rxDrops: numberValue(item, "rx-drop"),
  }));
}

function normalizeHotspotSessions(sessions) {
  return sessions
    .map((item) => ({
      identifier: stringValue(item, ".id") || stringValue(item, "user"),
      username: stringValue(item, "user"),
      bytes: numberValue(item, "bytes-in") + numberValue(item, "bytes-out"),
      interfaceName: stringValue(item, "interface"),
    }))
    .filter((session) => session.identifier && session.username);
}

function normalizeDhcpLeases(leases) {
  return leases.map((item) => ({
    ipAddress: stringValue(item, "address") || stringValue(item, "active-address"),
    macAddress: stringValue(item, "mac-address") || stringValue(item, "active-mac-address"),
    hostname: stringValue(item, "host-name") || stringValue(item, "hostname") || undefined,
    status: stringValue(item, "status") || undefined,
    expiresAt: (() => {
      const remaining = millisecondsFromDuration(item["expires-after"]);
      return remaining === undefined ? undefined : Date.now() + remaining;
    })(),
  })).filter((lease) => lease.ipAddress && lease.macAddress);
}

function normalizeSimpleQueues(queues) {
  return queues.map((item) => ({
    name: stringValue(item, "name"),
    target: stringValue(item, "target") || undefined,
    rateBps: parseBandwidthBps(item["limit-at"]),
    maxLimitBps: parseBandwidthBps(item["max-limit"]),
    disabled: booleanValue(item, "disabled"),
  })).filter((queue) => queue.name);
}

function normalizeEthernetPorts(ports) {
  return ports.map((item) => ({
    name: stringValue(item, "name"),
    running: booleanValue(item, "running"),
    linkSpeedMbps: parseSpeedMbps(item.speed),
    duplex: stringValue(item, "duplex") || undefined,
    disabled: booleanValue(item, "disabled"),
  })).filter((port) => port.name);
}

function normalizeWifiRadios(radios) {
  return radios.map((item) => ({
    interfaceName: stringValue(item, "interface") || stringValue(item, "name"),
    state: booleanValue(item, "running") ? "running" : booleanValue(item, "disabled") ? "disabled" : stringValue(item, "state") || "down",
    frequency: leadingNumberValue(item, "frequency"),
    channel: stringValue(item, "channel") || stringValue(item, "channel-width") || undefined,
    signalStrength: leadingNumberValue(item, "signal") ?? leadingNumberValue(item, "signal-strength"),
    clientCount: numberValue(item, "registered-clients") || numberValue(item, "client-count") || undefined,
  })).filter((radio) => radio.interfaceName);
}

function normalizeSystemHealth(records) {
  const record = records[0] ?? {};
  const temperature = leadingNumberValue(record, "temperature");
  const voltage = leadingNumberValue(record, "voltage");
  if (temperature === undefined && voltage === undefined) return null;
  return {
    temperature,
    temperatureUnit: stringValue(record, "temperature-kind") || undefined,
    voltage,
  };
}

/** Strips volatile counters so configuration drift reflects real config edits, not traffic. */
function sanitizeForConfigurationSnapshot(value) {
  if (Array.isArray(value)) {
    return value.map((record) => {
      if (typeof record !== "object" || record === null) return record;
      return Object.fromEntries(
        Object.entries(record).filter(([key]) => ![
          "bye-packet",
          "tx-byte",
          "rx-byte",
          "tx-packet",
          "rx-packet",
          "tx-error",
          "rx-error",
          "tx-drop",
          "rx-drop",
          "fp-rx-byte",
          "fp-tx-byte",
          "fp-rx-packet",
          "fp-tx-packet",
          "uptime",
          "age",
          "last-link-up-time",
          "expires-after",
          "last-seen",
          "active-address",
          "active-mac-address",
          "active-server",
          "active-client-id",
          "active-address-lists",
          "active-nexthop",
          "active-gateway",
          "instant-tx-bits-per-second",
          "instant-rx-bits-per-second",
          "tx-bits-per-second",
          "rx-bits-per-second",
          "bytes",
          "packets",
          "rate",
          "capped-bytes",
          "disabled-capped-bytes",
          "total-bytes",
          "total-packets",
          "dynamic",
        ].includes(key)),
      );
    });
  }
  return value;
}

async function readExtendedGroup(partials) {
  const extendedCalls = {
    pools: "/ip/pool",
    dns: "/ip/dns",
    routes: "/ip/route",
    dhcpLeases: "/ip/dhcp-server/lease",
    simpleQueues: "/queue/simple",
    firewallRules: "/ip/firewall/filter",
    ethernet: "/interface/ethernet",
    ipAddresses: "/ip/address",
  };
  const extended = {};
  for (const [key, path] of Object.entries(extendedCalls)) {
    try {
      extended[key] = await readRouter(path);
    } catch (error) {
      if (error && error.statusCode === 404) {
        partials.push(`${key} (unsupported)`);
      } else {
        partials.push(key);
      }
      extended[key] = [];
    }
  }
  try {
    extended.wifi = await readRouter("/interface/wifi");
  } catch {
    try {
      extended.wifi = await readRouter("/interface/wireless");
    } catch {
      partials.push("wifi");
      extended.wifi = [];
    }
  }
  return extended;
}

async function collectSnapshot() {
  await loadConnection();
  const startedAt = Date.now();

  const [resources, interfaces, hotspotSessions] = await Promise.all([
    readRouter("/system/resource"),
    readRouter("/interface"),
    readRouter("/ip/hotspot/active"),
  ]);
  const latencyMs = Date.now() - startedAt;
  const resource = resources[0] ?? {};

  const partials = [];
  const extended = await readExtendedGroup(partials);

  let systemHealth = null;
  let identity = null;
  try {
    systemHealth = normalizeSystemHealth(await readRouter("/system/health"));
  } catch {
    partials.push("systemHealth");
  }
  try {
    identity = stringValue((await readRouter("/system/identity"))[0] ?? {}, "name") || null;
  } catch {
    partials.push("identity");
  }

  const configurationSnapshot = {
    interfaces: sanitizeForConfigurationSnapshot(interfaces),
    pools: sanitizeForConfigurationSnapshot(extended.pools),
    dns: sanitizeForConfigurationSnapshot(extended.dns),
    routes: sanitizeForConfigurationSnapshot(extended.routes),
    dhcpLeases: sanitizeForConfigurationSnapshot(extended.dhcpLeases),
    simpleQueues: sanitizeForConfigurationSnapshot(extended.simpleQueues),
    firewallRules: sanitizeForConfigurationSnapshot(extended.firewallRules),
    ipAddresses: sanitizeForConfigurationSnapshot(extended.ipAddresses),
  };

  return {
    routerId,
    observedAt: Date.now(),
    cpuPercent: numberValue(resource, "cpu-load"),
    totalMemoryBytes: numberValue(resource, "total-memory"),
    freeMemoryBytes: numberValue(resource, "free-memory"),
    interfaces: normalizeInterfaces(interfaces),
    hotspotSessions: normalizeHotspotSessions(hotspotSessions),
    dhcpLeases: normalizeDhcpLeases(extended.dhcpLeases),
    simpleQueues: normalizeSimpleQueues(extended.simpleQueues),
    ethernetPorts: normalizeEthernetPorts(extended.ethernet),
    wifiRadios: normalizeWifiRadios(extended.wifi),
    systemHealth,
    identity,
    configurationSnapshotJson: JSON.stringify(configurationSnapshot),
    latencyMs,
    partials,
  };
}

async function forwardSnapshot(snapshot) {
  const { partials, ...payload } = snapshot;
  const response = await fetchFromDashboard("/collector/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mylesnet-collector-secret": sharedSecret,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("The dashboard did not accept the collector snapshot.");
  }
  return partials;
}

async function reportStatus({ status, message, partialTelemetry, latencyMs }) {
  const body = {
    routerId,
    observedAt: Date.now(),
    status,
    message: message ?? undefined,
    latencyMs,
    consecutiveFailures,
    processUptimeMs: Date.now() - PROCESS_UPSTART_AT,
    partialTelemetry,
    configVersion,
  };
  try {
    await fetchFromDashboard("/collector/status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mylesnet-collector-secret": sharedSecret },
      body: JSON.stringify(body),
    });
  } catch {
    // Telemetry failures must not be hidden by a secondary status-report failure.
  }
}

function backoffDelay() {
  return Math.min(BACKOFF_CAP_MS, (intervalMilliseconds * 2) * (2 ** Math.min(consecutiveFailures - 1, 8)));
}

function jitter(base) {
  return Math.round(base * (0.9 + Math.random() * 0.2));
}

async function runOnce() {
  const startedAt = Date.now();
  try {
    await loadConnection();
    let snapshot;
    try {
      snapshot = await collectSnapshot();
    } catch (error) {
      if (error && (error.statusCode === 401 || error.statusCode === 403)) {
        await loadConnection({ force: true });
        snapshot = await collectSnapshot();
      } else {
        throw error;
      }
    }
    snapshot.latencyMs = Math.max(snapshot.latencyMs ?? 0, Date.now() - startedAt);
    const partials = await forwardSnapshot(snapshot);
    consecutiveFailures = 0;
    const message = partials.length
      ? `Some extended telemetry was skipped: ${partials.join(", ")}.`
      : null;
    await reportStatus({ status: "connected", message, partialTelemetry: partials, latencyMs: snapshot.latencyMs });
    return { status: "connected", message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Collector run failed.";
    console.error(message);
    consecutiveFailures += 1;
    await reportStatus({ status: "failed", message });
    return { status: "failed", message };
  }
}

async function loop() {
  if (shuttingDown) return;
  const result = await runOnce();
  if (shuttingDown) return;
  const delay = result.status === "connected"
    ? jitter(intervalMilliseconds)
    : jitter(backoffDelay());
  timer = setTimeout(() => void loop(), delay);
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearTimeout(timer);
  await reportStatus({ status: "failed", message: "Collector stopped." });
  process.exit(0);
}

const firstRun = await runOnce();

if (runOnceMode) {
  process.exitCode = firstRun.status === "connected" ? 0 : 1;
} else {
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  timer = setTimeout(() => void loop(), firstRun.status === "connected" ? jitter(intervalMilliseconds) : jitter(backoffDelay()));
}