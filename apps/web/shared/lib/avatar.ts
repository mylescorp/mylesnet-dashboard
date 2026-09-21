export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const CONVEX_STORAGE_HOST_SUFFIX = ".convex.cloud";

/** Only render persisted avatar URLs that belong to the approved storage host. */
export function trustedAvatarSource(url: string | undefined | null, hasStorageRecord: boolean): string | undefined {
  if (!url || !hasStorageRecord) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(CONVEX_STORAGE_HOST_SUFFIX)
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the approved deterministic avatar fallback when WorkOS has no image.
 * The seed is the stable internal user id so a user keeps the same avatar across
 * the shell, access table, and profile editor.
 */
export function avatarFallbackUrl(userId: string, name: string) {
  const seed = encodeURIComponent(`${userId}-${name}`);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundType=solid&backgroundColor=b74400&fontColor=ffffff`;
}

