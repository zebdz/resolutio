import { describe, it, expect } from 'vitest';
import { slugifyOrgName } from '../orgSlug';

describe('slugifyOrgName', () => {
  it('lowercases ASCII org names', () => {
    expect(slugifyOrgName('Acme Corp')).toBe('acme-corp');
  });

  it('preserves Cyrillic letters', () => {
    expect(slugifyOrgName('Московский Клуб')).toBe('московский-клуб');
  });

  it('handles mixed Latin and Cyrillic', () => {
    expect(slugifyOrgName('NOMOS НОМОС')).toBe('nomos-номос');
  });

  it('replaces non-letter non-digit sequences with a single dash', () => {
    expect(slugifyOrgName('Foo!!!  Bar???')).toBe('foo-bar');
  });

  it('keeps digits', () => {
    expect(slugifyOrgName('Club 42')).toBe('club-42');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugifyOrgName('!!!Foo!!!')).toBe('foo');
  });

  it('caps length at 60 characters', () => {
    const longName = 'a'.repeat(100);
    expect(slugifyOrgName(longName)).toBe('a'.repeat(60));
  });

  it('returns "org" as fallback for empty input', () => {
    expect(slugifyOrgName('')).toBe('org');
  });

  it('returns "org" as fallback for punctuation-only input', () => {
    expect(slugifyOrgName('!!!???')).toBe('org');
  });

  it('trims whitespace on the edges before slugifying', () => {
    expect(slugifyOrgName('   Foo Bar   ')).toBe('foo-bar');
  });

  it('collapses multiple consecutive spaces into a single dash', () => {
    expect(slugifyOrgName('Foo     Bar')).toBe('foo-bar');
  });
});
