import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractWorkosEvent, verifyWorkosWebhook } from "./lib/workosVerify";

const http = httpRouter();

/**
 * WorkOS webhook receiver.
 *
 * Verifies the `WorkOS-Signature` header (HMAC-SHA256 over
 * `<timestamp>.<raw_body>` with the endpoint signing secret, ~5 min tolerance),
 * then dispatches user/membership/invitation/session/role events to keep the
 * local identity, membership cache and role registry in sync.
 */
http.route({
  path: "/workos/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("WorkOS-Signature");
    const secret = process.env.WORKOS_WEBHOOK_SECRET;
    const event = extractWorkosEvent(rawBody) ?? "unrecognized";

    if (!secret) {
      return Response.json(
        { success: false, message: "The WorkOS webhook is not configured." },
        { status: 503 },
      );
    }

    let signatureValid = false;
    try {
      signatureValid = await verifyWorkosWebhook(rawBody, signatureHeader, secret);
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      await ctx.runMutation(internal.workosWebhook.logWorkosDelivery, {
        eventType: event,
        signatureValid: false,
        processed: false,
        errorMessage: "Webhook signature verification failed.",
      });
      return Response.json(
        { success: false, message: "The webhook signature is invalid." },
        { status: 401 },
      );
    }

    let data: unknown = {};
    try {
      const payload = JSON.parse(rawBody) as { id?: unknown; data?: unknown };
      data = payload.data ?? {};
      const eventId = typeof payload.id === "string" && payload.id.length > 0
        ? payload.id
        : `unidentified:${event}:${rawBody.slice(0, 256)}`;
      const queued = await ctx.runMutation(internal.workosWebhook.enqueueWorkosEvent, {
        eventId,
        event,
        data,
      });
      await ctx.runMutation(internal.workosWebhook.logWorkosDelivery, {
        eventType: event,
        signatureValid: true,
        processed: false,
        errorMessage: queued.duplicate ? "Duplicate delivery acknowledged." : undefined,
      });
      return Response.json({ success: true, eventType: event, accepted: true, duplicate: queued.duplicate });
    } catch {
      return Response.json(
        { success: false, message: "The request body was not valid JSON." },
        { status: 400 },
      );
    }
  }),
});

export default http;