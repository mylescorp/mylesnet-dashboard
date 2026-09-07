import { test } from "node:test";
import assert from "node:assert/strict";
import { Healthguard, parseHealthguardEnv, serviceDisabled } from "./healthguard.mjs";

const REST_BASE = "https://router.example:8443";

function serviceRecord(overrides = {}) {
  return { ".id": "*3", name: "www-ssl", disabled: false, ...overrides };
}

function makeRouter(records) {
  const calls = [];
  const patchTargets = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), path: url.pathname, method: init.method ?? "GET", body: init.body ?? null });
    if (init.method === "PATCH") {
      patchTargets.push(url.pathname);
      return {
        ok: true,
        status: 200,
        async json() {
          return serviceRecord({ ".id": url.pathname.split("/").pop(), disabled: false });
        },
      };
    }
    if (url.pathname === "/rest/ip/service") {
      return { ok: true, status: 200, async json() { return records; } };
    }
    return { ok: false, status: 404, async json() { return {}; } };
  };
  return { fetchImpl, calls, patchTargets, records };
}

function guardWith(recordsOverrides, envOverrides = {}, fetchImpl) {
  const router = makeRouter(recordsOverrides);
  const guard = new Healthguard({
    config: parseHealthguardEnv({ MYLESNET_HEALTHGUARD_ENABLED: "true", ...envOverrides }),
    fetchImpl: fetchImpl ?? router.fetchImpl,
  });
  guard.connect({ restBaseUrl: REST_BASE, username: "collector", password: "pw" });
  return { router, guard };
}

test("parseHealthguardEnv applies defaults and reads overrides", () => {
  const defaults = parseHealthguardEnv({});
  assert.equal(defaults.enabled, true);
  assert.equal(defaults.intervalMs, 60_000);
  assert.equal(defaults.minRetryMs, 5 * 60_000);

  const overrides = parseHealthguardEnv({
    MYLESNET_HEALTHGUARD_ENABLED: "0",
    MYLESNET_HEALTHGUARD_INTERVAL_MS: "25000",
    MYLESNET_HEALTHGUARD_MIN_RETRY_MS: "120000",
  });
  assert.equal(overrides.enabled, false);
  assert.equal(overrides.intervalMs, 25_000);
  assert.equal(overrides.minRetryMs, 120_000);

  const lowInterval = parseHealthguardEnv({ MYLESNET_HEALTHGUARD_INTERVAL_MS: "100" });
  assert.equal(lowInterval.intervalMs, 5000, "the interval floor is 5s");
});

test("serviceDisabled handles boolean and string shapes", () => {
  assert.equal(serviceDisabled({ disabled: true }), true);
  assert.equal(serviceDisabled({ disabled: false }), false);
  assert.equal(serviceDisabled({ disabled: "true" }), true);
  assert.equal(serviceDisabled({ disabled: "false" }), false);
  assert.equal(serviceDisabled({ disabled: "yes" }), true);
  assert.equal(serviceDisabled({}), false);
});

test("a healthy www-ssl service needs no action", async () => {
  const { router, guard } = guardWith([serviceRecord({ disabled: false })]);
  const status = await guard.run(1_000_000);
  assert.equal(status.wwwSslEnabled, true);
  assert.equal(status.lastAction, "none");
  assert.equal(status.lastActionAt, null);
  assert.equal(router.calls.filter((call) => call.method === "PATCH").length, 0);
});

test("a disabled www-ssl is re-enabled with a PATCH and verified", async () => {
  const { router, guard } = guardWith([serviceRecord({ disabled: true })]);
  const status = await guard.run(1_000_000);
  assert.equal(status.lastAction, "reenabled_www_ssl");
  assert.equal(status.wwwSslEnabled, true);
  assert.equal(typeof status.lastActionAt, "number");
  assert.equal(router.patchTargets.length, 1);
  assert.match(router.patchTargets[0], /\/rest\/ip\/service\//);
  const body = JSON.parse(router.calls.find((call) => call.method === "PATCH").body);
  assert.deepEqual(body, { disabled: false });
});

test("a repeat re-enable is throttled by the retry cooldown", async () => {
  const { router, guard } = guardWith([
    serviceRecord({ disabled: true }),
    serviceRecord({ disabled: true }),
  ]);
  const first = await guard.runNow(1_000_000);
  assert.equal(first.lastAction, "reenabled_www_ssl");
  const second = await guard.runNow(1_000_000 + 30_000);
  assert.equal(second.lastAction, "flagged_disabled");
  assert.equal(router.patchTargets.length, 1, "the second attempt stays inside the cooldown");
});

test("shouldRun gates on interval but runs immediately when brand new", async () => {
  const { guard } = guardWith([serviceRecord({ disabled: false })]);
  assert.equal(guard.shouldRun(1000), true, "a brand new guard runs right away");
  guard.lastRunAt = 1000;
  assert.equal(guard.shouldRun(1000 + 4000), false);
  guard.lastRunAt = 1000;
  assert.equal(guard.shouldRun(1000 + 60_000), true);
});

test("a rejected PATCH is reported as reenable_failed", async () => {
  const { guard } = guardWith([serviceRecord({ disabled: true })], {}, async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/ip/service") {
      return { ok: true, status: 200, async json() { return [serviceRecord({ disabled: true })]; } };
    }
    return { ok: false, status: 403, async json() { return {}; } };
  });
  const status = await guard.run(1_000_000);
  assert.equal(status.lastAction, "reenable_failed");
  assert.equal(status.wwwSslEnabled, false);
  assert.match(status.lastActionMessage ?? "", /HTTP 403/);
});

test("a PATCH that does not stick is reported as reenable_failed", async () => {
  const { guard } = guardWith([serviceRecord({ disabled: true })]);
  const status = await guard.run(1_000_000);
  assert.equal(status.lastAction, "reenable_failed");
  assert.equal(status.wwwSslEnabled, false);
  assert.match(status.lastActionMessage ?? "", /still reports disabled/);
});

test("an unreachable router sets wwwSslEnabled to unknown instead of crashing", async () => {
  const { guard } = guardWith([], {}, async () => {
    throw new TypeError("fetch failed");
  });
  const status = await guard.run(1_000_000);
  assert.equal(status.wwwSslEnabled, null);
  assert.equal(status.lastRunAt, 1_000_000);
  assert.match(status.lastActionMessage ?? "", /Could not reach/);
});

test("the server kill switch stops the guard without touching the router", async () => {
  const { router, guard } = guardWith([serviceRecord({ disabled: true })]);
  guard.setServerEnabled(false);
  const status = await guard.runNow(1_000_000);
  assert.equal(status.enabled, false);
  assert.equal(router.calls.length, 0);
  assert.equal(guard.shouldRun(1_000_002), false);
});