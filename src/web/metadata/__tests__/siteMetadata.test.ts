import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildSiteMetadata } from '../siteMetadata';

// Real message files, so the tests fail if a locale loses its copy.
function appTranslator(locale: string) {
  const messages = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'messages', `${locale}.json`),
      'utf-8'
    )
  );

  return (key: string) => messages.app[key];
}

describe('buildSiteMetadata', () => {
  it('describes the site in Russian for the ru locale', () => {
    const metadata = buildSiteMetadata({
      locale: 'ru',
      t: appTranslator('ru'),
    });

    expect(metadata.description).toMatch(/[А-Яа-яЁё]/);
  });

  it('describes the site in English for the en locale', () => {
    const metadata = buildSiteMetadata({
      locale: 'en',
      t: appTranslator('en'),
    });

    expect(metadata.description).not.toMatch(/[А-Яа-яЁё]/);
    expect(metadata.description).toMatch(/organizations/i);
  });

  it('advertises the locale to crawlers via openGraph', () => {
    const ru = buildSiteMetadata({ locale: 'ru', t: appTranslator('ru') });
    const en = buildSiteMetadata({ locale: 'en', t: appTranslator('en') });

    expect(ru.openGraph?.locale).toBe('ru_RU');
    expect(en.openGraph?.locale).toBe('en_US');
  });

  it("names the site in the reader's language", () => {
    const ru = buildSiteMetadata({ locale: 'ru', t: appTranslator('ru') });
    const en = buildSiteMetadata({ locale: 'en', t: appTranslator('en') });

    expect(ru.openGraph?.siteName).toBe('НОМОС');
    expect(en.openGraph?.siteName).toBe('NOMOS');
  });

  // A child segment replaces the whole inherited `openGraph` object, but Next
  // then backfills og:title / og:description from that page's own title and
  // description. Leaving both unset here is what lets every page advertise its
  // own heading instead of the site name.
  it('leaves openGraph title and description unset so pages fill their own', () => {
    const metadata = buildSiteMetadata({
      locale: 'ru',
      t: appTranslator('ru'),
    });

    expect(metadata.openGraph?.title).toBeUndefined();
    expect(metadata.openGraph?.description).toBeUndefined();
  });

  it('falls back to the default locale for an unknown locale', () => {
    const metadata = buildSiteMetadata({
      locale: 'xx',
      t: appTranslator('ru'),
    });

    expect(metadata.openGraph?.locale).toBe('ru_RU');
  });
});
