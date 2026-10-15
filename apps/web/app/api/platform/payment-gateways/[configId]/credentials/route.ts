import {
  CreateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  ResourceExistsException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation } from "convex/nextjs";
import { createHash, createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CSRF_COOKIE_NAME, csrfCookieOptions } from "@/shared/auth/cookies";
import { CSRF_HEADER_NAME, generateCsrfToken, verifyCsrfToken } from "@/shared/auth/csrf";
import { AuthRequiredError, requireRole, RoleRequiredError } from "@/shared/auth/session";
import { platformPaymentGateways } from "@/shared/convex/platformPaymentGateways";
import { paymentCredentialAttestationPayload } from "../../../../../../../../convex/lib/paymentCredentialAttestation";

export const runtime = "nodejs";

const credentialInput = z.object({
  consumerKey: z.string().trim().min(1).max(512),
  consumerSecret: z.string().min(1).max(2048),
  passkey: z.string().min(1).max(2048),
}).strict();

const jsonHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const PAYMENT_CREDENTIAL_MAX_AUTH_AGE_MS = 5 * 60 * 1000;
const PAYMENT_GATEWAY_MANAGERS = ["platform_super_admin", "platform_owner"];
const secretNameForConfig = (configId: string) => {
  const opaque = createHash("sha256").update(configId, "utf8").digest("hex");
  return `mylesnet/payment-gateways/cfg-${opaque}`;
};

function credentialAttestation(configId: string, operationId: string, versionId: string) {
  const key = process.env.PAYMENT_CREDENTIAL_ROTATION_ATTESTATION_KEY;
  if (!key || key.length < 32) throw new Error("Payment credential storage is unavailable.");
  const payload = paymentCredentialAttestationPayload({ configId, operationId, versionId });
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status, headers: jsonHeaders });
}

function createSecretsManagerClient() {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error("Payment credential storage is unavailable.");
  if (process.env.VERCEL === "1") {
    const roleArn = process.env.AWS_ROLE_ARN;
    if (!roleArn) throw new Error("Payment credential storage is unavailable.");
    return new SecretsManagerClient({ region, credentials: awsCredentialsProvider({ roleArn }) });
  }
  return new SecretsManagerClient({ region });
}

async function readLimitedBody(request: NextRequest, limit: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function writeCredentialVersion(input: {
  configId: string;
  operationId: string;
  credentialJson: string;
  kmsKeyId: string;
}) {
  const client = createSecretsManagerClient();
  const secretName = secretNameForConfig(input.configId);
  let secretExists = false;
  try {
    await client.send(new DescribeSecretCommand({ SecretId: secretName }));
    secretExists = true;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }

  if (secretExists) {
    const result = await client.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: input.credentialJson,
      ClientRequestToken: input.operationId,
    }));
    if (!result.VersionId) throw new Error("Credential version was not confirmed.");
    return result.VersionId;
  }

  try {
    const result = await client.send(new CreateSecretCommand({
      Name: secretName,
      Description: "Tenant-owned payment gateway credentials",
      KmsKeyId: input.kmsKeyId,
      SecretString: input.credentialJson,
      ClientRequestToken: input.operationId,
    }));
    if (!result.VersionId) throw new Error("Credential version was not confirmed.");
    return result.VersionId;
  } catch (error) {
    if (!(error instanceof ResourceExistsException)) throw error;
    const result = await client.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: input.credentialJson,
      ClientRequestToken: input.operationId,
    }));
    if (!result.VersionId) throw new Error("Credential version was not confirmed.");
    return result.VersionId;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ configId: string }> },
) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return failure("This request could not be verified.", 403);
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME);
  if (!verifyCsrfToken(csrfCookie, csrfHeader)) return failure("Refresh the page and try again.", 403);

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("Check the credential fields and try again.", 415);
  }

  const { configId } = await context.params;
  const operationId = request.headers.get("Idempotency-Key") ?? "";
  let rotationStarted = false;
  let secretVersionWritten = false;
  let accessToken: string | undefined;

  try {
    const session = await requireRole(PAYMENT_GATEWAY_MANAGERS);
    const authAge = session.authenticatedAt === undefined ? Number.POSITIVE_INFINITY : Date.now() - session.authenticatedAt.getTime();
    if (authAge < 0 || authAge > PAYMENT_CREDENTIAL_MAX_AUTH_AGE_MS) {
      return failure("Sign in again before updating payment credentials.", 428);
    }
    accessToken = (await withAuth()).accessToken;
    if (!accessToken) return failure("Please sign in again to continue.", 401);
    // The Convex mutation applies the SA guard before the request body is read.
    await fetchMutation(platformPaymentGateways.beginRotation, {
      configId,
      operationId,
    }, { token: accessToken });
    rotationStarted = true;

    const rawBody = await readLimitedBody(request, 16_384);
    if (rawBody === null) {
      await fetchMutation(platformPaymentGateways.failRotation, { configId, operationId }, { token: accessToken });
      rotationStarted = false;
      return failure("The credential form is too large.", 413);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      await fetchMutation(platformPaymentGateways.failRotation, { configId, operationId }, { token: accessToken });
      rotationStarted = false;
      return failure("Check the credential fields and try again.", 400);
    }
    const parsed = credentialInput.safeParse(parsedBody);
    if (!parsed.success) {
      await fetchMutation(platformPaymentGateways.failRotation, { configId, operationId }, { token: accessToken });
      rotationStarted = false;
      return failure("Check the credential fields and try again.", 400);
    }

    const kmsKeyId = process.env.AWS_PAYMENT_SECRETS_KMS_KEY_ID;
    if (!kmsKeyId) throw new Error("Payment credential storage is unavailable.");
    const versionId = await writeCredentialVersion({
      configId,
      operationId,
      credentialJson: JSON.stringify(parsed.data),
      kmsKeyId,
    });
    secretVersionWritten = true;

    await fetchMutation(platformPaymentGateways.completeRotation, {
      configId,
      operationId,
      versionId,
      attestation: credentialAttestation(configId, operationId, versionId),
    }, { token: accessToken });

    const nextCsrfToken = generateCsrfToken();
    const response = NextResponse.json({ success: true, message: "Payment credentials were updated.", csrfToken: nextCsrfToken }, { headers: jsonHeaders });
    response.cookies.set(CSRF_COOKIE_NAME, nextCsrfToken, csrfCookieOptions());
    return response;
  } catch (error) {
    if (accessToken && rotationStarted && !secretVersionWritten) {
      try {
        await fetchMutation(platformPaymentGateways.failRotation, { configId, operationId }, { token: accessToken });
      } catch {
        // Keep the response safe; a stale lease can be retried after its bounded expiry.
      }
    }
    if (error instanceof AuthRequiredError) return failure("Please sign in again to continue.", 401);
    if (error instanceof RoleRequiredError) return failure("You do not have permission to update payment credentials.", 403);
    return failure(
      secretVersionWritten
        ? "The credentials were saved, but the update could not be confirmed. Retry with the same request."
        : "The credentials could not be saved. Check the fields and try again.",
      503,
    );
  }
}
