/**
 * Internationalization utilities and hooks.
 * Export the main i18n components and utilities for use across the app.
 */

export { useTranslations } from 'next-intl';
export { Link, redirect, usePathname, useRouter } from './routing';
export { getLocaleFromPath, isLocaleSupported, type Locale } from './config';
