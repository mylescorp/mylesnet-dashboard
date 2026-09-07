import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/** Server-backed integration posture; secrets and credentials are never returned. */
export const getIntegrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "centipid:manage");
    const centipid = await ctx.db.query("centipidCredentials").order("desc").first();
    const routers = await ctx.db.query("routers").collect();
    const credentials = await ctx.db.query("routerCredentials").collect();
    return {
      centipid: { configured: centipid !== null, paused: centipid?.ingestionPaused === true, lastSyncAt: centipid?.liveSnapshotLastAttemptAt ?? null },
      routerOs: { configuredRouters: credentials.length, totalRouters: routers.length },
      sms: { configured: Boolean(process.env.AFRICAS_TALKING_USERNAME && process.env.AFRICAS_TALKING_API_KEY) },
      email: { configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM) },
      mobileMoney: { configured: false },
    };
  },
});
