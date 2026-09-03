import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function bytesMatch(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function secretMatches(receivedSecret: string, expectedSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(receivedSecret)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedSecret)),
  ]);
  return bytesMatch(new Uint8Array(receivedHash), new Uint8Array(expectedHash));
}

http.route({
  path: "/collector/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.MYLESNET_COLLECTOR_SHARED_SECRET;
    const receivedSecret = request.headers.get("x-mylesnet-collector-secret");
    if (!expectedSecret) {
      return Response.json(
        { success: false, message: "The collector service is not configured." },
        { status: 503 },
      );
    }
    if (!receivedSecret || !(await secretMatches(receivedSecret, expectedSecret))) {
      return Response.json(
        { success: false, message: "The collector could not be verified." },
        { status: 401 },
      );
    }

    try {
      await ctx.runMutation(internal.collector.ingestSnapshot, await request.json());
      return Response.json({ success: true });
    } catch {
      return Response.json(
        { success: false, message: "The collector data could not be saved." },
        { status: 400 },
      );
    }
  }),
});

http.route({
  path: "/collector/config",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.MYLESNET_COLLECTOR_SHARED_SECRET;
    const receivedSecret = request.headers.get("x-mylesnet-collector-secret");
    const routerId = new URL(request.url).searchParams.get("routerId");
    if (!expectedSecret) {
      return Response.json(
        { success: false, message: "The collector service is not configured." },
        { status: 503 },
      );
    }
    if (!receivedSecret || !(await secretMatches(receivedSecret, expectedSecret))) {
      return Response.json(
        { success: false, message: "The collector could not be verified." },
        { status: 401 },
      );
    }

    if (!routerId) {
      return Response.json(
        { success: false, message: "The collector configuration is incomplete." },
        { status: 400 },
      );
    }

    const connection = await ctx.runAction(internal.routerCredentialActions.getDecryptedCollectorConnection, { routerId });
    if (!connection) {
      return Response.json(
        { success: false, message: "The requested router is not ready for collection." },
        { status: 404 },
      );
    }

    return Response.json({ success: true, connection });
  }),
});

/** The provider contract is unverified, so this endpoint deliberately fails closed. */
http.route({
  path: "/receiveCentipidWebhook",
  method: "POST",
  handler: httpAction(async () => {
    return Response.json(
      { success: false, message: "This integration is not available." },
      { status: 503 },
    );
  }),
});

export default http;
