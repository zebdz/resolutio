import { describe, it, expect } from 'vitest';
import { resolveReturnToPath } from '../returnToCapture';

const htmlGet = { method: 'GET', accept: 'text/html,application/xhtml+xml' };

describe('resolveReturnToPath', () => {
  it('strips the locale prefix', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/ru/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/en/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
  });

  it('keeps a path that has no locale prefix', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
  });

  it.each([
    '/',
    '/login',
    '/register',
    '/confirm-phone',
    '/privacy-setup',
    '/blocked',
    '/rate-limited',
    '/ip-blocked',
  ])('skips %s under both locales', (path) => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: `/ru${path}` })
    ).toBeNull();
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: `/en${path}` })
    ).toBeNull();
    expect(resolveReturnToPath({ ...htmlGet, pathname: path })).toBeNull();
  });

  it('skips the bare locale root', () => {
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru' })).toBeNull();
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru/' })).toBeNull();
  });

  it('skips non-GET requests', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, method: 'POST', pathname: '/ru/polls' })
    ).toBeNull();
  });

  it('skips non-HTML requests', () => {
    expect(
      resolveReturnToPath({
        method: 'GET',
        accept: 'image/png',
        pathname: '/ru/polls',
      })
    ).toBeNull();
    expect(
      resolveReturnToPath({
        method: 'GET',
        accept: null,
        pathname: '/ru/polls',
      })
    ).toBeNull();
  });

  it('skips API routes', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/api/polls/x/results/pdf' })
    ).toBeNull();
  });

  it('keeps other authenticated pages', () => {
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru/reports' })).toBe(
      '/reports'
    );
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/ru/organizations/123' })
    ).toBe('/organizations/123');
  });

  it('rejects paths that fail return-to validation', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '//evil.example.com' })
    ).toBeNull();
  });
});
