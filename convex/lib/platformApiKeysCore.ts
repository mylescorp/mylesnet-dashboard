export function validatePlatformKeyInput(nameInput: string, scopesInput: string[], expiresAt: number | undefined, now: number) {
  const name = nameInput.trim();
  if (!name || name.length > 80) throw new Error("Key name must be between 1 and 80 characters");
  const scopes = [...new Set(scopesInput)];
  if (!scopes.length || scopes.length > 4 || scopes.some(scope => !["organizations:read"].includes(scope))) throw new Error("Choose between 1 and 4 supported API scopes");
  if (expiresAt !== undefined && (expiresAt <= now || expiresAt > now + 365 * 24 * 60 * 60 * 1000)) throw new Error("Expiry must be within the next 365 days");
  return { name, scopes };
}

export function isPlatformApiKeyActive(key: { revokedAt?: number; expiresAt?: number }, now: number): boolean {
  return key.revokedAt === undefined && (key.expiresAt === undefined || key.expiresAt > now);
}
