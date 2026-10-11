/**
 * Routing configuration for next-intl.
 * Defines supported locales and default locale.
 */

import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'fr', 'sw'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Automatically detect user's locale from browser preferences
  localePrefix: 'as-needed',
});

// Lightweight navigation utilities (client-side)
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
