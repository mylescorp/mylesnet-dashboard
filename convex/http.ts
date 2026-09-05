import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { decryptCentipidSecret } from "./lib/centipidCredentials";
import {
  classifyEvent,
  extractEventType,
  extractWebhookEventId,
  verifyWebhookSignature,
} from "./lib/centipidVerify";

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

    return Response.json({
      success: true,
      connection: {
        restBaseUrl: connection.restBaseUrl,
        username: connection.username,
        password: connection.password,
      },
      configVersion: connection.configVersion,
    });
  }),
});

http.route({
  path: "/collector/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.MYLESNET_COLLECTOR_SHARED_SECRET;
    const receivedSecret = request.headers.get("x-mylesnet-collector-secret");
    if (!expectedSecret) return Response.json({ success: false, message: "The collector service is not configured." }, { status: 503 });
    if (!receivedSecret || !(await secretMatches(receivedSecret, expectedSecret))) return Response.json({ success: false, message: "The collector could not be verified." }, { status: 401 });
    try {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object") throw new Error("Invalid collector status");
      const report = body as {
        routerId?: unknown;
        observedAt?: unknown;
        status?: unknown;
        message?: unknown;
        latencyMs?: unknown;
        consecutiveFailures?: unknown;
        processUptimeMs?: unknown;
        partialTelemetry?: unknown;
      };
      if (typeof report.routerId !== "string" || typeof report.observedAt !== "number" || (report.status !== "connected" && report.status !== "failed") || (report.message !== undefined && typeof report.message !== "string") || (report.latencyMs !== undefined && typeof report.latencyMs !== "number") || (report.consecutiveFailures !== undefined && typeof report.consecutiveFailures !== "number") || (report.processUptimeMs !== undefined && typeof report.processUptimeMs !== "number") || (report.partialTelemetry !== undefined && (!Array.isArray(report.partialTelemetry) || report.partialTelemetry.some((item) => typeof item !== "string")))) throw new Error("Invalid collector status");
      await ctx.runMutation(internal.collector.recordCollectorRun, {
        routerId: report.routerId as never,
        observedAt: report.observedAt,
        status: report.status,
        message: report.message?.slice(0, 240),
        latencyMs: report.latencyMs,
        consecutiveFailures: report.consecutiveFailures,
        processUptimeMs: report.processUptimeMs,
        partialTelemetry: report.partialTelemetry?.slice(0, 20),
      });
      return Response.json({ success: true });
    } catch {
      return Response.json({ success: false, message: "The collector status could not be saved." }, { status: 400 });
    }
  }),
});

const maximumRawBodyPreviewLength = 4000;

function centipidSignatureHeader(request: Request): string | null {
  return (
    request.headers.get("x-centipid-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("signature")
  );
}

function rawBodyPreview(rawBody: string): string {
  return rawBody.length > maximumRawBodyPreviewLength
    ? rawBody.slice(0, maximumRawBodyPreviewLength)
    : rawBody;
}

/**
 * Centipid webhook receiver.
 *
 * Until the provider contract is pinned by a real signed delivery the route runs
 * in capture mode: every delivery is acknowledged (HTTP 200) and its raw signing
 * header + body preview are logged to `webhookDeliveryLog`, but no events are
 * written. Once credentials are configured it runs in live mode: the raw-body
 * HMAC signature is verified, recognized events are routed to their handler,
 * and out-of-order confirmation is de-duplicated on the webhook event id.
 */
http.route({
  path: "/receiveCentipidWebhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signatureHeader = centipidSignatureHeader(request);
    const preview = rawBodyPreview(rawBody);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: "unknown",
        signatureValid: false,
        processed: false,
        errorMessage: "The request body was not valid JSON.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: false, message: "The request body was not valid JSON." }, { status: 400 });
    }

    const creds = await ctx.runQuery(internal.centipid.getCentipidCredentials, {});
    const capturedEventType = extractEventType(payload) ?? (payload && typeof payload === "object" ? "unrecognized" : "malformed");

    if (!creds) {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: capturedEventType,
        signatureValid: false,
        processed: false,
        errorMessage: "Received in capture mode awaiting the provider contract.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: true, captured: true });
    }

    if (creds.ingestionPaused === true) {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: capturedEventType,
        signatureValid: false,
        processed: false,
        errorMessage: "Ingestion is paused; the delivery was acknowledged and skipped.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: true, paused: true });
    }

    let signatureValid = false;
    try {
      signatureValid = await verifyWebhookSignature(rawBody, signatureHeader, await decryptCentipidSecret(creds.webhookSigningSecret));
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: capturedEventType,
        signatureValid: false,
        processed: false,
        errorMessage: "Webhook signature verification failed.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: false, message: "The webhook signature is invalid." }, { status: 401 });
    }

    const { category, eventType: typedEventType } = classifyEvent(payload);
    if (!category || !typedEventType) {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: capturedEventType,
        signatureValid: true,
        processed: false,
        errorMessage: "Signature valid but the event type is not recognized.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: true, ignored: true });
    }

    const webhookEventId = extractWebhookEventId(payload) ?? undefined;
    const handlerArguments = { payload, webhookEventId };
    try {
      if (category === "subscriber") {
        await ctx.runMutation(internal.centipid.handleSubscriberEvent, handlerArguments);
      } else if (category === "payment") {
        await ctx.runMutation(internal.centipid.handlePaymentEvent, handlerArguments);
      } else if (category === "voucher") {
        await ctx.runMutation(internal.centipid.handleVoucherEvent, handlerArguments);
      } else {
        await ctx.runMutation(internal.centipid.handleTicketEvent, handlerArguments);
      }
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: typedEventType,
        signatureValid: true,
        processed: true,
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: true, eventType: typedEventType });
    } catch (error) {
      await ctx.runMutation(internal.centipid.logWebhookDelivery, {
        eventType: typedEventType,
        signatureValid: true,
        processed: false,
        errorMessage: error instanceof Error ? error.message.slice(0, 240) : "The event could not be stored.",
        signatureHeader: signatureHeader ?? undefined,
        rawBodyPreview: preview,
      });
      return Response.json({ success: false, message: "The event could not be stored." }, { status: 500 });
    }
  }),
});

export default http;
