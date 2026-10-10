export type PlatformBrandingDefaults = { supportEmail: string; supportPhone: string; brandColor: string };

export function inheritPlatformBranding(
  stored: { supportEmail?: unknown; supportPhone?: unknown; brandColor?: unknown; brandColorOverride?: unknown },
  defaults: PlatformBrandingDefaults | undefined,
  fallbackColor: string,
) {
  const supportEmail = typeof stored.supportEmail === "string" ? stored.supportEmail.trim() : "";
  const supportPhone = typeof stored.supportPhone === "string" ? stored.supportPhone.trim() : "";
  const color = typeof stored.brandColor === "string" ? stored.brandColor.trim().toUpperCase() : fallbackColor;
  const hasColorOverride = stored.brandColorOverride === true || color !== fallbackColor;
  return {
    supportEmail: supportEmail || defaults?.supportEmail || "",
    supportPhone: supportPhone || defaults?.supportPhone || "",
    brandColor: /^#[0-9A-F]{6}$/.test(color) && hasColorOverride ? color : defaults?.brandColor ?? fallbackColor,
  };
}
