/**
 * Returns the approved deterministic avatar fallback when WorkOS has no image.
 * The seed is the stable internal user id so a user keeps the same avatar across
 * the shell, access table, and profile editor.
 */
export function avatarFallbackUrl(userId: string, name: string) {
  const seed = encodeURIComponent(`${userId}-${name}`);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundType=solid&backgroundColor=b74400&fontColor=ffffff`;
}

export function trustedAvatarSource(url: string | undefined | null, hasStorageRecord: boolean): string | undefined {
  if (!url || !hasStorageRecord) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".convex.cloud")
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
