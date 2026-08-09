import { redirect } from '@/src/i18n/routing';

/**
 * Redirects while keeping the visitor in the locale they arrived in.
 *
 * `redirect` from `next/navigation` takes a bare path and so drops the
 * /[locale] prefix; the proxy then falls back to `defaultLocale`. That is why
 * an English visitor sent away from a protected page landed on the Russian
 * login page — and why link previews for /en URLs rendered in Russian.
 *
 * Takes the locale rather than reading it itself, so the function can stay
 * synchronous and keep returning `never`. An async wrapper would lose that:
 * TypeScript does not narrow through `await`, so callers would no longer get
 * `user` narrowed to non-null after `if (!user) redirectLocalized(...)`.
 * Pass `await getLocale()` from `next-intl/server` at the call site.
 */
export function redirectLocalized(locale: string, href: string): never {
  // `return` rather than a bare call: TypeScript only treats a call as
  // never-returning when the callee has an explicit type annotation, and
  // next-intl's `redirect` is inferred from `createNavigation`.
  return redirect({ href, locale });
}
