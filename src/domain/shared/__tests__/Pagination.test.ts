/** Pagination units reject fractions, infinities and nonpositive values before
 * they can become query offsets/limits; ordinary integer arithmetic is retained. */
import { describe, expect, it } from 'vitest';
import { PageNumber, PageSize, ResultLimit, ResultCount } from '../Pagination';
describe('pagination units', () => {
  it('represents empty and nonempty result totals as safe nonnegative integers', () => {
    expect(ResultCount.parse(0)).toBe(0);
    expect(ResultCount.parse(25)).toBe(25);

    for (const raw of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '25',
    ]) {
      expect(ResultCount.safeParse(raw).success).toBe(false);
    }
  });

  it('accepts positive safe integers and rejects invalid query units', () => {
    for (const schema of [PageNumber, PageSize, ResultLimit]) {
      expect(schema.parse(1)).toBe(1);

      for (const raw of [
        0,
        -1,
        1.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
        '1',
      ]) {
        expect(schema.safeParse(raw).success).toBe(false);
      }
    }

    expect((PageNumber.parse(3) - 1) * PageSize.parse(20)).toBe(40);
  });
});
