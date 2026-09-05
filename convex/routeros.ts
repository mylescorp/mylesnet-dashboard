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

const ROUTER_FETCH_TIMEOUT_MS = 10_000;

function encodeBasicCredentials(username: string, password: string): string {
  const credentials = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of credentials) binary += String.fromCharCode(byte);
  return btoa(binary);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTER_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConvexError(
        "The router did not respond in time. Check that it is online and reachable.",
      );
    }
    throw new ConvexError(
      "The router could not be reached over the network. Verify the router URL, credentials, and network path.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ConvexError("We could not read the router right now.");
  }

  try {
    return parseRecords(await response.text());
  } catch {
    throw new ConvexError(
      "The router returned a response we could not understand.",
    );
  }
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
export const getDhcpLeases = routerRead("/ip/dhcp-server/lease");
export const getSimpleQueues = routerRead("/queue/simple");
export const getFirewallRules = routerRead("/ip/firewall/filter");
export const getEthernet = routerRead("/interface/ethernet");
export const getWifi = routerRead("/interface/wifi");
export const getSystemHealth = routerRead("/system/health", true);
export const getIdentity = routerRead("/system/identity", true);
export const getIpAddresses = routerRead("/ip/address");
