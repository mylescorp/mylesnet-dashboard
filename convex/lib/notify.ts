import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/**
 * Notification transport-fanout (spec §17 + §20). Africa's Talking is the SMS
 * provider (sandbox fallback), Resend is email. Provider credentials live in
 * environment variables — same convention as the collector shared secret and
 * Resend key already used in this repo:
 *   AFRICAS_TALKING_USERNAME / AFRICAS_TALKING_API_KEY
 *   RESEND_API_KEY / RESEND_FROM
 */

export type NotifyChannel = "sms" | "email" | "dashboard";

export interface NotifyPayload {
  subject: string;
  smsText: string;
  emailHtml: string;
}

async function sendSms(phone: string, message: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const username = process.env.AFRICAS_TALKING_USERNAME;
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  if (!username || !apiKey) {
    return { ok: false, error: "sms_not_configured" };
  }
  try {
    const body = new URLSearchParams({
      username: username === "sandbox" ? "sandbox" : username,
      to: phone,
      message,
    });
    if (process.env.AFRICAS_TALKING_SENDER_ID) body.set("from", process.env.AFRICAS_TALKING_SENDER_ID);
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) return { ok: false, error: `sms_http_${res.status}` };
    const data = (await res.json()) as { SMSMessageData?: { Message?: string; Recipients?: { messageId?: string; cost?: string; failureReason?: string }[] } };
    const recipient = data.SMSMessageData?.Recipients?.[0];
    if (recipient?.failureReason) return { ok: false, error: recipient.failureReason };
    return { ok: true, messageId: recipient?.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "sms_unknown" };
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "MylesNet <no-reply@mylesnet.africa>";
  if (!apiKey) return { ok: false, error: "email_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) return { ok: false, error: `email_http_${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "email_unknown" };
  }
}

/**
 * Fan out a notification to one user on one channel, honouring their stored
 * preference (internal query resolves it). Dashboard channel always stores a
 * systemEvent so the in-app bell never depends on SMS/email delivery.
 */
export async function notifyUser(
  ctx: Pick<MutationCtx, "runQuery"> & { db: MutationCtx["db"] },
  userId: string,
  category: string,
  channel: NotifyChannel,
  payload: NotifyPayload,
): Promise<{ dispatched: boolean; reason?: string; provider?: "sms" | "email" }> {
  const user = (await ctx.db.get(userId as never)) as {
    _id: string;
    deletedAt?: number;
    phone?: string;
    email?: string;
  } | null;
  if (!user || user.deletedAt !== undefined) return { dispatched: false, reason: "no_user" };

  if (channel === "dashboard") {
    await ctx.db.insert("systemEvents", {
      routerId: undefined,
      accessPointId: undefined,
      type: "notification",
      severity: "info",
      title: payload.subject,
      details: category,
      occurredAt: Date.now(),
    });
    return { dispatched: true };
  }

  const pref = await ctx.runQuery(internal.notifications.isPreferenceEnabled, {
    userId: userId as never,
    category,
    channel,
  });
  if (!pref.enabled) return { dispatched: false, reason: "preference_disabled" };

  if (channel === "sms") {
    const result = await sendSms(user.phone ?? "", payload.smsText);
    return result.ok
      ? { dispatched: true, provider: "sms" }
      : { dispatched: false, reason: result.error };
  }

  const result = await sendEmail(user.email ?? "", payload.subject, payload.emailHtml);
  return result.ok
    ? { dispatched: true, provider: "email" }
    : { dispatched: false, reason: result.error };
}

export { sendSms, sendEmail };