/** Generated reset passwords keep their existing composition guarantee before hashing.
 * Randomness and human-readable grouping remain the generator adapter's responsibility. */
import { expect, it } from 'vitest';
import { GeneratedPassword } from '../UserValues';

it.each(['', 'Aa2', 'abcdefghijk', 'ABCDEFGH2', 'Abcdefghi'])(
  'rejects an invalid generated password: %j',
  (value) => {
    expect(GeneratedPassword.safeParse(value).success).toBe(false);
  }
);

it('preserves valid generated password bytes', () => {
  const value = 'Abc2-Def3-Ghi4-Jkm5';
  expect(GeneratedPassword.parse(value)).toBe(value);
});
