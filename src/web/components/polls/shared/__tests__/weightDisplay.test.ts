import { describe, it, expect } from 'vitest';
import { formatWeightAndPercent } from '../weightDisplay';

describe('formatWeightAndPercent', () => {
  it('total zero → 0.00%', () => {
    expect(formatWeightAndPercent(0.5, 0)).toBe('0.50 (0.00%)');
  });
  it('half of total → 50.00%', () => {
    expect(formatWeightAndPercent(1, 2)).toBe('1.00 (50.00%)');
  });
  it('rounds to two decimal places', () => {
    expect(formatWeightAndPercent(0.333333, 1)).toBe('0.33 (33.33%)');
  });
});
