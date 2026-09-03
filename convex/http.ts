import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

    const connection = await ctx.runQuery(internal.routers.getCollectorConnection, { routerId });
    if (!connection) {
      return Response.json(
        { success: false, message: "The requested router is not ready for collection." },
        { status: 404 },
      );
    }

    return Response.json({ success: true, connection });
  }),
});

/**
 * Centipid webhook handler. Verifies the HMAC-SHA256 signature against
 * the stored signing secret, then routes the event to the appropriate
 * Convex mutation based on the event type.
 */
http.route({
  path: "/receiveCentipidWebhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("x-centipid-signature");

    const credentials = await ctx.runQuery(internal.centipid.getCentipidCredentials);
    if (!credentials) {
      return Response.json(
        { success: false, message: "Centipid integration not configured." },
        { status: 503 },
      );
    }

    if (signature) {
      const valid = await secretMatches(signature, credentials.webhookSigningSecret);
      if (!valid) {
        await ctx.runMutation(internal.centipid.logWebhookDelivery, {
          eventType: "unknown",
          signatureValid: false,
          processed: false,
          errorMessage: "Invalid signature",
        });
        return Response.json(
          { success: false, message: "Invalid signature." },
          { status: 401 },
        );
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return Response.json(
        { success: false, message: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const eventType = (payload.event_type ?? payload.eventType ?? "unknown") as string;

    try {
      if (eventType.startsWith("subscriber.")) {
        await ctx.runMutation(internal.centipid.handleSubscriberEvent, { payload });
      } else if (eventType.startsWith("payment.")) {
        await ctx.runMutation(internal.centipid.handlePaymentEvent, { payload });
      } else if (eventType.startsWith("voucher.")) {
        await ctx.runMutation(internal.centipid.handleVoucherEvent, { payload });
      } else if (eventType.startsWith("ticket.")) {
        await ctx.runMutation(internal.centipid.handleTicketEvent, { payload });
      } else {
        await ctx.runMutation(internal.centipid.logWebhookDelivery, {
          eventType,
          signatureValid: true,
          processed: false,
          errorMessage: `Unknown event type: ${eventType}`,
        });
        return Response.json(
          { success: false, message: `Unknown event type: ${eventType}` },
          { status: 400 },
        );
      }

      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType,
        signatureValid: true,
        processed: true,
      });

      return Response.json({ success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Processing failed";
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType,
        signatureValid: true,
        processed: false,
        errorMessage,
      });
      return Response.json(
        { success: false, message: "Webhook processing failed." },
        { status: 500 },
      );
    }
  }),
});

/**
 * Revoke an agent's WorkOS session and clear all __mylesnet_* cookies.
 * Called from the offboarding wizard after the Convex mutation completes.
 */
http.route({
  path: "/api/revokeAgentSession",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { agentId?: string };
    if (!body.agentId) {
      return Response.json(
        { success: false, message: "Missing agentId." },
        { status: 400 },
      );
    }

    try {
      const agent = await ctx.runQuery(internal.agents.getAgentInternal, {
        agentId: body.agentId as Id<"agents">,
      });
      if (!agent) {
        return Response.json(
          { success: false, message: "Agent not found." },
          { status: 404 },
        );
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      const cookieNames = ["__mylesnet_session", "__mylesnet_tenant", "__mylesnet_csrf"];
      for (const name of cookieNames) {
        headers.append(
          "Set-Cookie",
          `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Session revoked and cookies cleared." }),
        { status: 200, headers }
      );
    } catch {
      return Response.json(
        { success: false, message: "Session revocation failed." },
        { status: 500 },
      );
    }
  }),
});

export default http;
