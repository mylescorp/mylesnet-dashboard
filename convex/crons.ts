import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "prune usage samples after 180 days",
  { hourUTC: 1, minuteUTC: 0 },
  internal.cron.pruneUsageSamples,
);

// Voucher expiry sweep — unsold vouchers owned by agents revert to "expired"
// rather than vanishing. Must be manually triggered and verified in the
// Convex dashboard before this schedule takes effect.
crons.daily(
  "sweep expired vouchers",
  { hourUTC: 2, minuteUTC: 0 },
  internal.vouchers.sweepExpiredVouchers,
);

// Weekly Centipid CSV reconciliation — matches customerPhoneAtRedemption
// against Centipid's export and writes renewalCredits. Pending verification
// of what the CSV export actually contains (see decisions.md — 4.7).
crons.weekly(
  "Centipid CSV reconciliation",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 30 },
  internal.operations.centipidCsvReconcile,
  {},
);

// Daily leaderboard snapshot — per-agent ranking by sales/renewal/commission.
crons.daily(
  "leaderboard snapshot",
  { hourUTC: 3, minuteUTC: 0 },
  internal.operations.computeLeaderboardDaily,
);

// Monthly operating cost reminder — flags any active market missing a cost
// entry for the current month, surfacing it on the platform dashboard.
crons.monthly(
  "operating cost reminder",
  { day: 1, hourUTC: 6, minuteUTC: 0 },
  internal.operations.runMonthlyCostReminder,
);

// Support ticket SLA check — flags tickets stuck in "open" beyond the SLA
// window (e.g. 48h) so they surface as action items.
crons.daily(
  "support ticket SLA check",
  { hourUTC: 4, minuteUTC: 0 },
  internal.operations.checkTicketSla,
);

// PII auto-purge — clears customerPhoneAtRedemption after the defined
// retention window (Kenya DPA 2019 lawful basis / purpose limitation).
crons.daily(
  "PII retention purge",
  { hourUTC: 5, minuteUTC: 0 },
  internal.operations.purgeExpiredPii,
);

// Centipid retention — clears webhook delivery logs older than 30 days, wipes
// subscriber raw payload previews older than 30 days, and drops events (plus
// their projection rows) older than 24 months.
crons.daily(
  "Centipid data retention",
  { hourUTC: 5, minuteUTC: 30 },
  internal.centipid.pruneCentipidData,
);

// Centipid token & pipeline health — auto-verifies the stored MCP key against
// the live endpoint and records the result so the settings page can flag a
// revoked key or dead pipeline even when no webhooks arrive.
crons.daily(
  "Centipid token health check",
  { hourUTC: 6, minuteUTC: 0 },
  internal.centipid.runCentipidHealthCheck,
);

// ---------------------------------------------------------------------------
// NOC v2 schedules
// ---------------------------------------------------------------------------

// FX rates — refresh USD reference rates hourly.
crons.hourly(
  "refresh FX rates",
  { minuteUTC: 20 },
  internal.forex.refreshExchangeRates,
  {},
);

// Maintenance windows — promote scheduled -> active as their start time passes.
crons.interval(
  "advance maintenance windows",
  { seconds: 600 },
  internal.maintenance.advanceMaintenanceWindows,
  {},
);

// Telemetry rollups — fold the previous complete hour into telemetryHourly.
crons.hourly(
  "hourly telemetry rollup",
  { minuteUTC: 25 },
  internal.rollups.runHourlyRollup,
  {},
);

// Nightly business rollups — telemetry hourly->daily, then dailySnapshots,
// subscriberSnapshots, marketFinancials, investor reports + housekeeping.
crons.daily(
  "nightly business rollup",
  { hourUTC: 1, minuteUTC: 40 },
  internal.rollups.buildTelemetryDaily,
  {},
);

crons.daily(
  "nightly NOC snapshots",
  { hourUTC: 2, minuteUTC: 10 },
  internal.rollups.runNightlyBusinessRollup,
  {},
);

// Scheduled report generation (daily digests + weekly/monthly exports).
crons.daily(
  "scheduled report generation",
  { hourUTC: 2, minuteUTC: 50 },
  internal.scheduledReports.triggerDueReports,
  {},
);

// Startup migrations — idempotent legacy-data folds; self-heal on fresh deploys.
crons.hourly(
  "startup migrations",
  { minuteUTC: 55 },
  internal.osMigrations.runStartupMigrations,
  {},
);

// Payout settlement sweep: approved -> processing after the confirmation window.
crons.hourly(
  "payout settlement sweep",
  { minuteUTC: 30 },
  internal.payouts.autoAdvancePayouts,
  {},
);

export default crons;
