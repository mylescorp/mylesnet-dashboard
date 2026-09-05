const credentialPrefix = "mncc.v1";
const initializationVectorLength = 12;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function encryptionKey(): Promise<CryptoKey> {
  const encodedKey = process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error("Centipid credential protection is not configured.");
  }

  let rawKey: Uint8Array;
  try {
    rawKey = base64ToBytes(encodedKey);
  } catch {
    throw new Error("Centipid credential protection is not configured.");
  }

  if (rawKey.length !== 32) {
    throw new Error("Centipid credential protection is not configured.");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a Centipid credential (API token or webhook signing secret) before it is persisted. */
export async function encryptCentipidSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(initializationVectorLength));
  const cipherText = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `${credentialPrefix}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherText))}`;
}

/**
 * Decrypt the protected format. Legacy plaintext values are accepted only to
 * preserve an already-working integration until the owner rotates the secret.
 */
export async function decryptCentipidSecret(value: string): Promise<string> {
  if (!value.startsWith(`${credentialPrefix}.`)) return value;

  const [, , encodedIv, encodedCipherText] = value.split(".");
  if (!encodedIv || !encodedCipherText) {
    throw new Error("Centipid credential data is invalid.");
  }

  try {
    const plainText = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(encodedIv)) },
      await encryptionKey(),
      toArrayBuffer(base64ToBytes(encodedCipherText)),
    );
    return new TextDecoder().decode(plainText);
  } catch {
    throw new Error("Centipid credentials could not be read.");
  }
}

export function isEncryptedCentipidSecret(value: string): boolean {
  return value.startsWith(`${credentialPrefix}.`);
}