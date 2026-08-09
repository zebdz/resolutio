import type { Metadata } from 'next';

/** Looks up a key inside the `app` message namespace. */
export type AppTranslator = (key: string) => string;

/**
 * Open Graph wants a `language_TERRITORY` tag, not the bare locale code that
 * routing uses.
 */
const OG_LOCALES: Record<string, string> = {
  ru: 'ru_RU',
  en: 'en_US',
};

export function toOpenGraphLocale(locale: string): string {
  return OG_LOCALES[locale] ?? OG_LOCALES.ru;
}

export interface SiteMetadataInput {
  locale: string;
  t: AppTranslator;
}

/**
 * Site-wide metadata for the root layout.
 *
 * Must be built per request rather than declared as a static
 * `export const metadata`: a static object is evaluated at module level and so
 * cannot read the `[locale]` segment, which is how every locale ended up
 * serving the English description in link previews.
 */
export function buildSiteMetadata({ locale, t }: SiteMetadataInput): Metadata {
  const title = t('title');
  const description = t('description');

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8080'
    ),
    title,
    description,
    // og:title and og:description are deliberately absent. A child segment
    // replaces this whole object rather than merging into it, but Next then
    // backfills those two from the page's own title/description — so leaving
    // them unset is what lets each page advertise its own heading while still
    // inheriting the site name and locale.
    openGraph: {
      siteName: title,
      type: 'website',
      locale: toOpenGraphLocale(locale),
    },
  };
}
