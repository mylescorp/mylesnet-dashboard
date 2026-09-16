/**
 * Returns the approved deterministic avatar fallback when WorkOS has no image.
 * The seed is the stable internal user id so a user keeps the same avatar across
 * the shell, access table, and profile editor.
 */
export function avatarFallbackUrl(userId: string, name: string) {
  const seed = encodeURIComponent(`${userId}-${name}`);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundType=solid&backgroundColor=b74400&fontColor=ffffff`;
}
