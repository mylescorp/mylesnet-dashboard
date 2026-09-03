import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

type RouterCredentials = {
  router: {
    restBaseUrl: string;
  };
  username: string;
  password: string;
};

type RouterOSRecord = Record<string, unknown>;

function encodeBasicCredentials(username: string, password: string): string {
  const credentials = new TextEncoder().encode(`${username}:${password}`);
  return btoa(String.fromCodePoint(...credentials));
}

function parseRecords(body: string): RouterOSRecord[] {
  const parsed: unknown = JSON.parse(body);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is RouterOSRecord =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }

  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? [parsed as RouterOSRecord]
    : [];
}

async function readRouterResource(
  credentials: RouterCredentials,
  path: string,
): Promise<RouterOSRecord[]> {
  const url = new URL(`/rest${path}`, credentials.router.restBaseUrl);
  const authorization = encodeBasicCredentials(
    credentials.username,
    credentials.password,
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${authorization}`,
    },
  });

  if (!response.ok) {
    throw new ConvexError("We could not read the router right now.");
  }

  return parseRecords(await response.text());
}

export const readMonitoringSnapshot = internalAction({
  args: { routerId: v.id("routers") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    resource: RouterOSRecord | null;
    interfaces: RouterOSRecord[];
    connectedUserCount: number;
  }> => {
    const credentials: RouterCredentials | null = await ctx.runAction(
      internal.routerCredentialActions.getDecryptedRouterConnection,
      args,
    );

    if (!credentials) {
      throw new ConvexError("This router is not ready for monitoring.");
    }

    const [resources, interfaces, hotspotSessions] = await Promise.all([
      readRouterResource(credentials, "/system/resource"),
      readRouterResource(credentials, "/interface"),
      readRouterResource(credentials, "/ip/hotspot/active"),
    ]);

    return {
      resource: resources[0] ?? null,
      interfaces,
      connectedUserCount: hotspotSessions.length,
    };
  },
});

export const readConfigurationSnapshot = internalAction({
  args: { routerId: v.id("routers") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    interfaces: RouterOSRecord[];
    pools: RouterOSRecord[];
    dns: RouterOSRecord[];
    routes: RouterOSRecord[];
  }> => {
    const credentials: RouterCredentials | null = await ctx.runAction(
      internal.routerCredentialActions.getDecryptedRouterConnection,
      args,
    );
    if (!credentials) {
      throw new ConvexError("This router is not ready for monitoring.");
    }

    const [interfaces, pools, dns, routes]: [
      RouterOSRecord[],
      RouterOSRecord[],
      RouterOSRecord[],
      RouterOSRecord[],
    ] = await Promise.all([
      readRouterResource(credentials, "/interface"),
      readRouterResource(credentials, "/ip/pool"),
      readRouterResource(credentials, "/ip/dns"),
      readRouterResource(credentials, "/ip/route"),
    ]);

    return { interfaces, pools, dns, routes };
  },
});

function routerRead(path: string, singleRecord = false) {
  return action({
    args: { routerId: v.id("routers") },
    handler: async (ctx, args) => {
      await ctx.runQuery(internal.platformUsers.assertNetworkOperator, {});
      const credentials = await ctx.runAction(
        internal.routerCredentialActions.getDecryptedRouterConnection,
        args,
      );

      if (!credentials) {
        throw new ConvexError("This router is not ready for monitoring.");
      }

      const records = await readRouterResource(credentials, path);
      return singleRecord ? (records[0] ?? null) : records;
    },
  });
}

// The dashboard uses GET-only RouterOS REST reads. No RouterOS write path exists.
export const getHotspotActive = routerRead("/ip/hotspot/active");
export const getSystemResource = routerRead("/system/resource", true);
export const getInterfaces = routerRead("/interface");
export const getBridgeHosts = routerRead("/interface/bridge/host");
export const getIpPools = routerRead("/ip/pool");
export const getIpPoolUsed = routerRead("/ip/pool/used");
export const getRoutes = routerRead("/ip/route");
export const getDns = routerRead("/ip/dns", true);
