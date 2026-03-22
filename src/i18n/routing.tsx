import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { forwardRef } from 'react';
import type { ComponentProps } from 'react';
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
const {
  Link: IntlLink,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);

// Default prefetch={false} to prevent Link prefetching from exhausting
// the MW session rate limit (120/min). Override with prefetch={true}
// on individual Links where instant navigation matters.
export const Link = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof IntlLink>
>(function Link(props, ref) {
  return <IntlLink prefetch={false} {...props} ref={ref} />;
});

export { redirect, usePathname, useRouter, getPathname };
