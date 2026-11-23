/** Plaintext credentials preserve exact entered bytes without imposing signup policy.
 * Generated passwords retain their stronger composition contract separately. */
import { expect, it } from 'vitest';
import { PlaintextPassword } from '../UserValues';

it.each(['', 'short', '  Abc123!  ', 'пароль\nс пробелом'])(
  'preserves entered password bytes %j',
  (password) => {
    expect(PlaintextPassword.parse(password)).toBe(password);
  }
);

it.each([null, 12345678, ['password'], Object('password')])(
  'rejects non-string credentials without coercion %#',
  (password) => {
    expect(PlaintextPassword.safeParse(password).success).toBe(false);
  }
);
