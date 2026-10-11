/**
 * Internationalization configuration for MylesNet tenant panel.
 * 
 * P1 languages: English (en), French (fr), Swahili (sw)
 * P2 languages: Arabic (ar, RTL), Portuguese (pt)
 * 
 * Default locale: English (en)
 * Supported locales are configured per tenant settings.
 */

export const locales = ['en', 'fr', 'sw'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  sw: 'Kiswahili',
};

export const localeLabels: Record<Locale, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  fr: { native: 'Français', english: 'French' },
  sw: { native: 'Kiswahili', english: 'Swahili' },
};

/**
 * Get the locale from a path segment (e.g., '/fr/dashboard' -> 'fr')
 * Returns default locale if no locale segment is found.
 */
export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment && locales.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  return defaultLocale;
}

/**
 * Check if a locale is supported
 */
export function isLocaleSupported(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
