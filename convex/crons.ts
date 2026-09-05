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

export default crons;
