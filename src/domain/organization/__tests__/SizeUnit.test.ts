/** Public size-unit choices cannot be mutated to alter the domain's accepted
 * units; selectors can inspect the list without changing validation policy. */
import { describe, expect, it } from 'vitest';
import { SizeUnit } from '../SizeUnit';
describe('SizeUnit', () => {
  it('keeps validation closed when a caller tries to modify the public choices', () => {
    Reflect.set(SizeUnit.values, 0, 'FURLONGS');
    expect(SizeUnit.parse('FURLONGS').success).toBe(false);
    expect(SizeUnit.parse('SQUARE_METERS').success).toBe(true);
  });
});
