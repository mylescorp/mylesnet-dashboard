import process from "node:process";

const runOnce = process.argv.includes("--once");

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
const intervalMilliseconds = Number(process.env.MYLESNET_COLLECTOR_INTERVAL_MS ?? "30000");

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

if (!Number.isSafeInteger(intervalMilliseconds) || intervalMilliseconds < 30000) {
  throw new Error("MYLESNET_COLLECTOR_INTERVAL_MS must be an integer of at least 30000.");
}

function asRecords(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value] : [];
}

async function getRouterConnection() {
  const configurationUrl = new URL("/collector/config", ingestUrl);
  configurationUrl.searchParams.set("routerId", routerId);
  let response;
  try {
    response = await fetch(configurationUrl, {
      headers: { "x-mylesnet-collector-secret": sharedSecret },
    });
  } catch {
    throw new Error("The collector could not reach the dashboard service.");
  }
  if (!response.ok) {
    throw new Error("The collector could not load the configured router connection.");
  }

  const payload = await response.json();
  const connection = payload?.connection;
  if (
    !connection ||
    typeof connection.restBaseUrl !== "string" ||
    typeof connection.username !== "string" ||
    typeof connection.password !== "string"
  ) {
    throw new Error("The collector received an invalid router connection.");
  }
  return connection;
}

async function readRouter(path, connection) {
  const authorization = `Basic ${Buffer.from(`${connection.username}:${connection.password}`).toString("base64")}`;
  let response;
  try {
    response = await fetch(new URL(`/rest${path}`, connection.restBaseUrl), {
      headers: { Accept: "application/json", Authorization: authorization },
    });
  } catch {
    throw new Error("The collector could not reach the router REST service.");
  }
  if (!response.ok) {
    throw new Error(`Router request failed for ${path}.`);
  }
  return asRecords(await response.json());
}

function numberValue(record, property) {
  const value = Number(record[property]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function stringValue(record, property) {
  const value = record[property];
  return typeof value === "string" ? value : "";
}

async function collectSnapshot() {
  const connection = await getRouterConnection();
  const [resources, interfaces, hotspotSessions, pools, dns, routes] = await Promise.all([
    readRouter("/system/resource", connection),
    readRouter("/interface", connection),
    readRouter("/ip/hotspot/active", connection),
    readRouter("/ip/pool", connection),
    readRouter("/ip/dns", connection),
    readRouter("/ip/route", connection),
  ]);
  const resource = resources[0] ?? {};
  const normalizedInterfaces = interfaces.map((item) => ({
    name: stringValue(item, "name"),
    running: stringValue(item, "running") === "true",
    txBytes: numberValue(item, "tx-byte"),
    rxBytes: numberValue(item, "rx-byte"),
    txErrors: numberValue(item, "tx-error"),
    rxErrors: numberValue(item, "rx-error"),
    txDrops: numberValue(item, "tx-drop"),
    rxDrops: numberValue(item, "rx-drop"),
  }));
  const normalizedSessions = hotspotSessions
    .map((item) => ({
      identifier: stringValue(item, ".id") || stringValue(item, "user"),
      username: stringValue(item, "user"),
      bytes: numberValue(item, "bytes-in") + numberValue(item, "bytes-out"),
      interfaceName: stringValue(item, "interface"),
    }))
    .filter((session) => session.identifier && session.username);

  return {
    routerId,
    observedAt: Date.now(),
    cpuPercent: numberValue(resource, "cpu-load"),
    totalMemoryBytes: numberValue(resource, "total-memory"),
    freeMemoryBytes: numberValue(resource, "free-memory"),
    interfaces: normalizedInterfaces,
    hotspotSessions: normalizedSessions,
    configurationSnapshotJson: JSON.stringify({ interfaces, pools, dns, routes }),
  };
}

async function forwardSnapshot() {
  const snapshot = await collectSnapshot();
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mylesnet-collector-secret": sharedSecret,
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error("The dashboard did not accept the collector snapshot.");
  }
}

async function run() {
  try {
    await forwardSnapshot();
    return true;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Collector run failed.");
    return false;
  }
}

const firstRunSucceeded = await run();

if (runOnce) {
  process.exitCode = firstRunSucceeded ? 0 : 1;
} else {
  setInterval(() => {
    void run();
  }, intervalMilliseconds);
}
