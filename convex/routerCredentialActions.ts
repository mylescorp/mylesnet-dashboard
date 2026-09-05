import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { decryptRouterCredential } from "./lib/routerCredentials";

/** Decrypts a router connection only within a server action immediately before use. */
export const getDecryptedRouterConnection = internalAction({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args): Promise<{
    router: { restBaseUrl: string };
    username: string;
    password: string;
  } | null> => {
    const connection = await ctx.runQuery(internal.routers.getRouterWithCredentials, args);
    if (!connection) return null;
    return {
      router: connection.router,
      username: await decryptRouterCredential(connection.username),
      password: await decryptRouterCredential(connection.password),
    };
  },
});

/** Provides a collector connection only after the HTTP route verifies its shared secret. */
export const getDecryptedCollectorConnection = internalAction({
  args: { routerId: v.string() },
  handler: async (ctx, args): Promise<{
    restBaseUrl: string;
    username: string;
    password: string;
    configVersion: string;
  } | null> => {
    const connection = await ctx.runQuery(internal.routers.getCollectorConnection, args);
    if (!connection) return null;
    return {
      restBaseUrl: connection.restBaseUrl,
      username: await decryptRouterCredential(connection.username),
      password: await decryptRouterCredential(connection.password),
      configVersion: connection.configVersion,
    };
  },
});
