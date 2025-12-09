import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './locales';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: locales as unknown as string[],

  // Used when no locale matches
  defaultLocale,

  // Always show locale in URL (even for default locale)
  // With this, /register will be redirected to /en/register
  localePrefix: 'always' as const,
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
