export type PaymentCredentialAttestation = {
  configId: string;
  operationId: string;
  versionId: string;
};

export function paymentCredentialAttestationPayload(input: PaymentCredentialAttestation): string {
  return JSON.stringify(input);
}

export async function verifyPaymentCredentialAttestation(
  input: PaymentCredentialAttestation & { attestation: string },
  key: string | undefined,
): Promise<boolean> {
  if (!key || key.length < 32) throw new Error("Payment credential verification is unavailable.");
  const signature = input.attestation.match(/^[A-Za-z0-9_-]{43}$/)?.[0];
  if (!signature) return false;
  const decode = (value: string) => Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4)),
    (character) => character.charCodeAt(0),
  );
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const { configId, operationId, versionId } = input;
  return crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    decode(signature),
    new TextEncoder().encode(paymentCredentialAttestationPayload({ configId, operationId, versionId })),
  );
}
