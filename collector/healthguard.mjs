import process from "node:process";

/**
 * MylesNet collector health guard.
 *
 * The collector tightly controls its own www-ssl service: the service gets
 * disabled for a reason or the whole HTTPS dashboard goes dark. Each cycle the
 * guard verifies `www-ssl` is enabled and, when it is not, re-enables it via a
 * single scoped PATCH on /rest/ip/service. Every outcome (nothing, flagged,
 * re-enabled, re-enable failed) is reported to the dashboard in the telemetry
 * payload so operators get `self_heal_action` / `self_heal_failed` /
 * `chronic_self_heal` events instead of silent drift.
 */

export const HEALTHGUARD_SERVICE = "www-ssl";

export function parseHealthguardEnv(env = process.env) {
  const bool = (value, fallback) => {
    if (value === undefined) return fallback;
    return value === "1" || String(value).toLowerCase() === "true";
  };
  const int = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  };
  return {
    enabled: bool(env.MYLESNET_HEALTHGUARD_ENABLED, true),
    intervalMs: Math.max(5000, int(env.MYLESNET_HEALTHGUARD_INTERVAL_MS, 60_000)),
    minRetryMs: int(env.MYLESNET_HEALTHGUARD_MIN_RETRY_MS, 5 * 60_000),
  };
}

export function serviceDisabled(record) {
  const value = record.disabled;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "yes";
}

export class Healthguard {
  constructor(options = {}) {
    this.config = options.config ?? parseHealthguardEnv();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.connection = null;
    this.serverEnabled = undefined;
    this.lastRunAt = null;
    this.wwwSslEnabled = null;
    this.lastAction = "none";
    this.lastActionAt = null;
    this.lastActionMessage = null;
    this.lastAttemptAt = null;
  }

  connect(connection) {
    this.connection = connection;
  }

  setServerEnabled(enabled) {
    this.serverEnabled = enabled;
  }

  get enabled() {
    if (this.serverEnabled === false) return false;
    return this.config.enabled;
  }

  status(now = Date.now()) {
    return {
      enabled: this.enabled,
      lastRunAt: this.lastRunAt,
      wwwSslEnabled: this.wwwSslEnabled,
      lastAction: this.lastAction,
      lastActionAt: this.lastActionAt,
      lastActionMessage: this.lastActionMessage,
    };
  }

  shouldRun(now = Date.now()) {
    if (!this.enabled) return false;
    if (this.lastRunAt === null) return true;
    return now - this.lastRunAt >= this.config.intervalMs;
  }

  /** Unconditional run, used by forced `run_full_healthcheck` commands. */
  async runNow(now = Date.now()) {
    return this.#run(now, true);
  }

  /** Runs when the configured interval has elapsed. */
  async run(now = Date.now()) {
    return this.#run(now, false);
  }

  async #run(now, force) {
    if (!this.enabled) {
      this.lastRunAt = now;
      return this.status(now);
    }
    if (!force && this.lastRunAt !== null && now - this.lastRunAt < this.config.intervalMs) {
      return this.status(now);
    }
    this.lastRunAt = now;
    const service = await this.#readService();
    if (!service) {
      this.wwwSslEnabled = null;
      return this.status(now);
    }
    if (!serviceDisabled(service)) {
      this.wwwSslEnabled = true;
      this.lastAction = "none";
      this.lastActionAt = null;
      this.lastActionMessage = null;
      return this.status(now);
    }
    this.wwwSslEnabled = false;
    if (this.lastAttemptAt !== null && now - this.lastAttemptAt < this.config.minRetryMs) {
      this.lastAction = "flagged_disabled";
      this.lastActionAt = now;
      this.lastActionMessage = "www-ssl is disabled on the router; the guard is in its retry cooldown.";
      return this.status(now);
    }
    this.lastAttemptAt = now;
    await this.#reEnable(service, now);
    return this.status(now);
  }

  async #readService() {
    if (!this.connection) {
      this.lastActionMessage = "The collector has no router connection configured.";
      return null;
    }
    let response;
    try {
      response = await this.fetchImpl(
        new URL("/rest/ip/service", this.connection.restBaseUrl),
        { headers: this.#authHeaders() },
      );
    } catch (error) {
      const code =
        error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause && typeof error.cause.code === "string"
          ? ` (${error.cause.code})`
          : "";
      this.lastActionMessage = `Could not reach the router REST service${code}.`;
      return null;
    }
    if (!response.ok) {
      this.lastActionMessage = `Reading /ip/service failed (HTTP ${response.status}).`;
      return null;
    }
    const records = await response.json();
    const list = Array.isArray(records) ? records : [records];
    const service = list.find((record) => record && record.name === HEALTHGUARD_SERVICE) ?? null;
    if (!service) {
      this.lastActionMessage = `No ${HEALTHGUARD_SERVICE} service is defined on the router.`;
      return null;
    }
    return service;
  }

  async #reEnable(service, now) {
    if (!this.connection) {
      this.lastAction = "reenable_failed";
      this.lastActionAt = now;
      this.lastActionMessage = "The collector has no router connection configured.";
      return;
    }
    const serviceId = service[".id"] ?? "";
    let response;
    try {
      response = await this.fetchImpl(
        new URL(`/rest/ip/service/${encodeURIComponent(serviceId)}`, this.connection.restBaseUrl),
        {
          method: "PATCH",
          headers: { ...this.#authHeaders(), "content-type": "application/json" },
          body: JSON.stringify({ disabled: false }),
        },
      );
    } catch (error) {
      const code =
        error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause && typeof error.cause.code === "string"
          ? ` (${error.cause.code})`
          : "";
      this.lastAction = "reenable_failed";
      this.lastActionAt = now;
      this.lastActionMessage = `The re-enable request could not reach the router${code}.`;
      return;
    }
    if (!response.ok) {
      this.lastAction = "reenable_failed";
      this.lastActionAt = now;
      this.lastActionMessage = `Re-enabling www-ssl failed (HTTP ${response.status}).`;
      return;
    }
    const verified = await this.#readService();
    if (verified && !serviceDisabled(verified)) {
      this.wwwSslEnabled = true;
      this.lastAction = "reenabled_www_ssl";
      this.lastActionAt = now;
      this.lastActionMessage = "Re-enabled www-ssl and verified it on the router.";
    } else {
      this.lastAction = "reenable_failed";
      this.lastActionAt = now;
      this.lastActionMessage = "The re-enable was accepted but www-ssl still reports disabled.";
    }
  }

  #authHeaders() {
    if (!this.connection) return {};
    const token = Buffer.from(`${this.connection.username}:${this.connection.password}`).toString("base64");
    return { Accept: "application/json", Authorization: `Basic ${token}` };
  }
}
