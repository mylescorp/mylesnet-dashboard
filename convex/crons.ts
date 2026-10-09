import { anyApi, cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Voucher expiry sweep — unsold vouchers owned by agents revert to "expired"
// rather than vanishing. Must be manually triggered and verified in the
// Convex dashboard before this schedule takes effect.
crons.daily(
  "sweep expired vouchers",
  { hourUTC: 2, minuteUTC: 0 },
  internal.vouchers.sweepExpiredVouchers,
);

// FX rates — refresh USD reference rates hourly.
crons.hourly(
  "refresh FX rates",
  { minuteUTC: 20 },
  internal.forex.refreshExchangeRates,
  {},
);

// Aggregate-only platform contracted-revenue history for C1.
crons.daily(
  "platform revenue snapshot",
  { hourUTC: 3, minuteUTC: 10 },
  anyApi.platformRevenue.captureDailySnapshot,
  {},
);

// Per-market revenue and operations snapshots used by analytics and reporting.
crons.daily(
  "market analytics snapshots",
  { hourUTC: 3, minuteUTC: 20 },
  internal.dailySnapshots.enqueueMarketSnapshotPage,
  { cursor: null },
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

// Finalize expired tenant deletion grace periods. Finalization blocks access
// and hides the workspace while preserving tenant records for retention work.
crons.hourly(
  "tenant deletion grace period sweep",
  { minuteUTC: 40 },
  internal.tenantControl.finalizeExpiredDeletions,
  {},
);

// Audit-chain integrity — advances a running verification sweep, or starts a
// fresh full sweep once the previous one finished, so every sealed audit row
// from genesis is re-verified on a rolling basis (see auditChainVerify.ts).
crons.hourly(
  "audit chain integrity sweep",
  { minuteUTC: 15 },
  internal.auditChainVerify.runAuditChainVerifyBatch,
  {},
);

export default crons;
