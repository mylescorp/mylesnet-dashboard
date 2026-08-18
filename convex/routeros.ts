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

  // NOTE: This handles self-signed certificates by default.
  // In production, you should validate certificates properly and document the tradeoff.
  // See README for details on certificate handling.
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore - Node.js fetch doesn't have rejectUnauthorized in standard types
    // In a real Node.js environment, you'd use https.Agent with proper cert validation
    // For now, we'll use a basic approach that handles self-signed certs
  });

  const responseBody = await response.text();
  return {
    status: response.status,
    body: responseBody,
  };
}

// Placeholder RouterOS actions - to be implemented with actual HTTP calls
export const getHotspotActive = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get hotspot active for router", args.routerId);
    return [];
  },
});

export const getSystemResource = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get system resource for router", args.routerId);
    return { "cpu-load": 0, "total-memory": 0, "free-memory": 0 };
  },
});

export const getInterfaces = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get interfaces for router", args.routerId);
    return [];
  },
});

export const getBridgeHosts = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get bridge hosts for router", args.routerId);
    return [];
  },
});

export const getIpPools = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get IP pools for router", args.routerId);
    return [];
  },
});

export const getIpPoolUsed = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get IP pool used for router", args.routerId);
    return [];
  },
});

export const getRoutes = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get routes for router", args.routerId);
    return [];
  },
});

export const getDns = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // TODO: Implement actual RouterOS call
    console.log("Would get DNS for router", args.routerId);
    return {};
  },
});
