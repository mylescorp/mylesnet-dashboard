import { v } from "convex/values";
import { action, query } from "./_generated/server";

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

// Internal query to get router with credentials (server-side only)
export const getRouterWithCredentials = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    const creds = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (!creds) return null;

    return {
      router,
      username: creds.encryptedUsername,
      password: creds.encryptedPassword,
    };
  },
});

// Temporarily disable RouterOS functions - will be enabled after credentials are tested
export const getHotspotActive = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getSystemResource = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getInterfaces = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getBridgeHosts = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getIpPools = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getIpPoolUsed = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getRoutes = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});

export const getDns = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    throw new Error("RouterOS integration pending credential testing");
  },
});
