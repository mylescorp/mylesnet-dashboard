import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { getRouterCredentials } from "./routers";

// IMPORTANT: All RouterOS communication happens server-side via this action.
// Credentials are NEVER exposed to the client - they're only read from the database
// inside this server-side action and used to make authenticated requests to the router.

interface RouterOSResponse {
  status: number;
  body: string;
}

async function routerRequest(
  baseUrl: string,
  username: string,
  password: string,
  path: string,
  method: string = "GET",
  body?: any
): Promise<RouterOSResponse> {
  const url = new URL(`/rest${path}`, baseUrl);
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Basic ${auth}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body)).toString();
  }

  // For self-signed certificates, we need to use a custom agent
  // In a Node.js environment, we'd use https.Agent with rejectUnauthorized: false
  // For now, we'll use fetch with the appropriate options
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore - Node.js fetch doesn't have standard types for these options
    // In production, you should use proper certificate validation
  });

  const responseBody = await response.text();
  return {
    status: response.status,
    body: responseBody,
  };
}

// Get active hotspot sessions from a router
export const getHotspotActive = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/ip/hotspot/active"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get system resource info (CPU, memory)
export const getSystemResource = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/system/resource"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload[0] : payload;
  },
});

// Get interface information
export const getInterfaces = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/interface"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get bridge host information (for MAC-to-port mapping)
export const getBridgeHosts = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/interface/bridge/host"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get IP pool information
export const getIpPools = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/ip/pool"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get IP pool used information
export const getIpPoolUsed = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/ip/pool/used"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get routing information
export const getRoutes = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/ip/route"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload : (payload ? [payload] : []);
  },
});

// Get DNS resolver information
export const getDns = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.runQuery(internalQueries.getRouter, { id: args.routerId });
    if (!router) throw new Error("Router not found");

    const creds = await ctx.runQuery(getRouterCredentials, { routerId: args.routerId });
    if (!creds) throw new Error("Router credentials not found");

    const result = await routerRequest(
      router.restBaseUrl,
      creds.username,
      creds.password,
      "/ip/dns"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload[0] : payload;
  },
});

// Internal queries (not exposed to client)
const internalQueries = {
  getRouter: query({
    args: { id: v.id("routers") },
    handler: async (ctx, args) => {
      return await ctx.db.get(args.id);
    },
  }),
};
