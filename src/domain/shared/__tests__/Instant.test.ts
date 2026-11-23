/** Canonical instants preserve millisecond evidence without sharing mutable Dates.
 * Boundary parsing accepts only complete, real UTC instants. */
import { describe, expect, it } from 'vitest';
import { Instant } from '../Instant';

describe('instants', () => {
  it('captures a Date value and returns fresh Dates without exposing mutable state', () => {
    const date = new Date('2026-10-26T10:00:00.123Z');
    const instant = Instant.fromDate(date);
    date.setUTCFullYear(2000);
    expect(instant).toBe('2026-10-26T10:00:00.123Z');

    const first = Instant.toDate(instant);
    first.setUTCMilliseconds(999);
    expect(Instant.toDate(instant).toISOString()).toBe(instant);
    expect(Instant.toDate(instant)).not.toBe(first);
  });

  it.each([
    'not a date',
    '2026-02-30T10:00:00.000Z',
    '2026-10-26T10:00:00Z',
    '2026-10-26T10:00:00.123456Z',
    '2026-10-26T10:00:00.123+00:00',
    '+010000-01-01T00:00:00.000Z',
    null,
    1793008800123,
  ])(
    'rejects noncanonical or invalid input %j without throwing from safeParse',
    (value) => {
      expect(Instant.safeParse(value).success).toBe(false);
      expect(() => Instant.parse(value)).toThrow();
    }
  );

  it.each([new Date(NaN), new Date('+010000-01-01T00:00:00.000Z')])(
    'rejects an invalid or unsupported Date %s',
    (value) => {
      expect(() => Instant.fromDate(value)).toThrow();
    }
  );
});
