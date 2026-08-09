import { describe, it, expect, vi, beforeEach } from 'vitest';

// Only Next's own redirect is stubbed, so it can be observed instead of
// throwing. The locale prefixing runs through the real routing config.
const nextRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => nextRedirect(url),
  permanentRedirect: (url: string) => nextRedirect(url),
  RedirectType: { push: 'push', replace: 'replace' },
}));

import { redirectLocalized } from '../redirectLocalized';

/**
 * Calls the subject and reports where it sent the visitor.
 *
 * The cast drops the `never` return type: with the real Next redirect stubbed
 * out nothing is thrown, so without it TypeScript would flag every assertion
 * below as unreachable.
 */
function redirectTarget(locale: string, href: string): string {
  (redirectLocalized as (locale: string, href: string) => void)(locale, href);

  return nextRedirect.mock.calls.at(-1)?.[0];
}

describe('redirectLocalized', () => {
  beforeEach(() => {
    nextRedirect.mockReset();
  });

  it('keeps an English visitor in English', () => {
    expect(redirectTarget('en', '/login')).toBe('/en/login');
  });

  it('keeps a Russian visitor in Russian', () => {
    expect(redirectTarget('ru', '/login')).toBe('/ru/login');
  });

  it('prefixes nested paths too', () => {
    expect(redirectTarget('en', '/polls/abc123')).toBe('/en/polls/abc123');
  });

  it('prefixes the site root', () => {
    expect(redirectTarget('en', '/')).toBe('/en');
  });
});
