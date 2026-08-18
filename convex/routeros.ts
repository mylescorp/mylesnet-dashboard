import { v } from "convex/values";
import { action } from "./_generated/server";

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

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseBody = await response.text();
  return {
    status: response.status,
    body: responseBody,
  };
}

// Get active hotspot sessions from a router
export const getHotspotActive = action({
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
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
  args: { routerId: v.id("routers"), username: v.string(), password: v.string(), restBaseUrl: v.string() },
  handler: async (ctx, args) => {
    const result = await routerRequest(
      args.restBaseUrl,
      args.username,
      args.password,
      "/ip/dns"
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Router returned ${result.status}`);
    }

    const payload = JSON.parse(result.body);
    return Array.isArray(payload) ? payload[0] : payload;
  },
});
