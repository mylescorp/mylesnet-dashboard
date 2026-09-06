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
import { extractWorkosEvent, verifyWorkosWebhook } from "./lib/workosVerify";

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
      const payload = JSON.parse(rawBody) as { data?: unknown };
      data = payload.data ?? {};
    } catch {
      return Response.json(
        { success: false, message: "The request body was not valid JSON." },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.runMutation(internal.workosWebhook.processWorkosEvent, { event, data });
      const handled = Boolean(result && typeof result === "object" && (result as { handled?: boolean }).handled);
      const failureReason: string | undefined = !handled
        ? ((result && typeof result === "object" && (result as { reason?: string }).reason) as string | undefined) ?? "unhandled_event"
        : undefined;
      await ctx.runMutation(internal.workosWebhook.logWorkosDelivery, {
        eventType: event,
        signatureValid: true,
        processed: handled,
        errorMessage: failureReason,
      });
      return Response.json({ success: true, eventType: event, handled });
    } catch (error) {
      await ctx.runMutation(internal.workosWebhook.logWorkosDelivery, {
        eventType: event,
        signatureValid: true,
        processed: false,
        errorMessage: error instanceof Error ? error.message.slice(0, 240) : "The event could not be stored.",
      });
      return Response.json(
        { success: false, message: "The event could not be stored." },
        { status: 500 },
      );
    }
  }),
});

/**
 * NOC v2 site-device endpoints (spec §10 siteKit + §20 telemetry).
 *
 * POST /api/telemetry         — outdoor APs report per-market readings; the
 *                               X-Site-Key header must match the market's
 *                               generated site key (constant-time hashed check).
 * POST /api/site-device/register — self-registration for the estate.
 */
http.route({
  path: "/api/telemetry",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const siteKey = request.headers.get("x-site-key");
    if (!siteKey) {
      return Response.json({ success: false, message: "The site key is missing." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, message: "The request body was not valid JSON." }, { status: 400 });
    }

    const payload = body as {
      apiVersion?: unknown;
      marketId?: unknown;
      observedAt?: unknown;
      devices?: unknown;
    };
    if (
      typeof payload.marketId !== "string" ||
      typeof payload.observedAt !== "number" ||
      !Array.isArray(payload.devices)
    ) {
      return Response.json({ success: false, message: "The telemetry payload is incomplete." }, { status: 400 });
    }

    const verified = await ctx.runQuery(internal.siteKit.verifyMarketSiteKey, {
      marketId: payload.marketId as never,
      keyToHash: siteKey,
    });
    if (!verified) {
      return Response.json({ success: false, message: "The site key is invalid." }, { status: 401 });
    }

    const devices = payload.devices.map((item: unknown) => item as {
      macAddress?: unknown;
      model?: unknown;
      firmware?: unknown;
      ccq?: unknown;
      signalStrengthDbm?: unknown;
      clientCount?: unknown;
      txBytesPerSec?: unknown;
      rxBytesPerSec?: unknown;
    });
    if (devices.some((device) => typeof device.macAddress !== "string")) {
      return Response.json({ success: false, message: "Each device must include a macAddress." }, { status: 400 });
    }
    const sanitized = devices.map((device) => ({
      macAddress: device.macAddress as string,
      model: typeof device.model === "string" ? device.model : undefined,
      firmware: typeof device.firmware === "string" ? device.firmware : undefined,
      ccq: typeof device.ccq === "number" ? device.ccq : undefined,
      signalStrengthDbm: typeof device.signalStrengthDbm === "number" ? device.signalStrengthDbm : undefined,
      clientCount: typeof device.clientCount === "number" ? device.clientCount : undefined,
      txBytesPerSec: typeof device.txBytesPerSec === "number" ? device.txBytesPerSec : undefined,
      rxBytesPerSec: typeof device.rxBytesPerSec === "number" ? device.rxBytesPerSec : undefined,
    }));

    try {
      const result = await ctx.runMutation(internal.siteTelemetry.ingestSpecTelemetry, {
        marketId: payload.marketId as never,
        observedAt: payload.observedAt,
        devices: sanitized,
      });
      return Response.json({ success: true, ...result });
    } catch {
      return Response.json({ success: false, message: "The telemetry could not be stored." }, { status: 500 });
    }
  }),
});

http.route({
  path: "/api/site-device/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const siteKey = request.headers.get("x-site-key");
    if (!siteKey) {
      return Response.json({ success: false, message: "The site key is missing." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, message: "The request body was not valid JSON." }, { status: 400 });
    }

    const payload = body as {
      marketId?: unknown;
      macAddress?: unknown;
      model?: unknown;
      deviceType?: unknown;
      name?: unknown;
    };
    if (
      typeof payload.marketId !== "string" ||
      typeof payload.macAddress !== "string" ||
      (payload.deviceType !== undefined &&
        payload.deviceType !== "mikrotik" &&
        payload.deviceType !== "outdoor_ap" &&
        payload.deviceType !== "indoor_ap" &&
        payload.deviceType !== "extender")
    ) {
      return Response.json({ success: false, message: "The registration payload is incomplete." }, { status: 400 });
    }

    const verified = await ctx.runQuery(internal.siteKit.verifyMarketSiteKey, {
      marketId: payload.marketId as never,
      keyToHash: siteKey,
    });
    if (!verified) {
      return Response.json({ success: false, message: "The site key is invalid." }, { status: 401 });
    }

    try {
      const result = await ctx.runMutation(internal.siteTelemetry.registerSpecDevice, {
        marketId: payload.marketId as never,
        macAddress: payload.macAddress,
        deviceType: (payload.deviceType as "mikrotik" | "outdoor_ap" | "indoor_ap" | "extender") ?? "outdoor_ap",
        model: typeof payload.model === "string" ? payload.model : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
      });
      return Response.json({ success: true, ...result });
    } catch {
      return Response.json({ success: false, message: "The device could not be registered." }, { status: 500 });
    }
  }),
});

export default http;
