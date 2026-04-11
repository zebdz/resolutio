import { describe, it, expect } from 'vitest';
import { buildJoinUrl } from '../buildJoinUrl';

describe('buildJoinUrl', () => {
  it('builds a path with slugified org name and token', () => {
    expect(buildJoinUrl('Acme Corp', 'abcd123xyz')).toBe(
      '/join/acme-corp/abcd123xyz'
    );
  });

  it('preserves Cyrillic in the slug', () => {
    expect(buildJoinUrl('Московский Клуб', 'abcd123xyz')).toBe(
      '/join/московский-клуб/abcd123xyz'
    );
  });

  it('uses the "org" fallback when the org name has no slug-able characters', () => {
    expect(buildJoinUrl('!!!', 'abcd123xyz')).toBe('/join/org/abcd123xyz');
  });

  it('returns a relative path starting with /join/', () => {
    expect(buildJoinUrl('Any Org', 'tok')).toMatch(/^\/join\//);
  });
});
