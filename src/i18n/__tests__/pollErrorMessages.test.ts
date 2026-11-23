/** Every application poll error must resolve in each supported locale.
 * Missing entries would expose raw error codes to users after a rejected action. */
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ru from '../../../messages/ru.json';
import { PollErrors } from '../../application/poll/PollErrors';

describe('poll application error messages', () => {
  it.each([
    ['en', en],
    ['ru', ru],
  ] as const)('resolves every known code in %s', (_locale, messages) => {
    for (const code of Object.values(PollErrors)) {
      let value: unknown = messages;

      for (const segment of code.split('.')) {
        value =
          value && typeof value === 'object'
            ? Reflect.get(value, segment)
            : undefined;
      }

      expect(value, code).toEqual(expect.any(String));
      expect(value, code).not.toBe('');
    }
  });
});
