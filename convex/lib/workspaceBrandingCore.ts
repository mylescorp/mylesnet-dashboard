export type PlatformBrandingDefaults = { supportEmail: string; supportPhone: string; brandColor: string };

export function mergeTenantBranding(
  stored: Record<string, unknown>,
  submitted: Record<string, unknown>,
  current: { supportEmail: string; supportPhone: string; brandColor: string },
) {
  const next = { ...stored };
  for (const key of ["supportEmail", "supportPhone"] as const) {
    if (!Object.prototype.hasOwnProperty.call(submitted, key)) continue;
    const value = typeof submitted[key] === "string" ? submitted[key].trim() : "";
    if (!value) delete next[key];
    else if (value !== current[key] || Object.prototype.hasOwnProperty.call(stored, key)) next[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(submitted, "brandColor")) {
    const value = typeof submitted.brandColor === "string" ? submitted.brandColor.trim().toUpperCase() : "";
    if (!value) {
      delete next.brandColor;
      delete next.brandColorOverride;
    } else if (/^#[0-9A-F]{6}$/.test(value)
      && (value !== current.brandColor || Object.prototype.hasOwnProperty.call(stored, "brandColor"))) {
      next.brandColor = value;
      next.brandColorOverride = true;
    }
  }
  return next;
}

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
