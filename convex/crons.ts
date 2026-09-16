import { cronJobs } from "convex/server";
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
