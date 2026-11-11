/** Persisted model keys and provider model slugs are separate identity contracts.
 * Invalid external identifiers must fail before registry lookup or provider invocation. */
import { describe, expect, it } from 'vitest';
import { AIModelKey, ProviderModelId } from '../LegalAnalysis';

describe('AI model identities', () => {
  it.each(['google', 'deepseek'])('preserves stored model key %s', (key) => {
    expect(AIModelKey.parse(key)).toBe(key);
  });

  it.each(['gemini-2.5-flash', 'deepseek-chat'])(
    'preserves provider slug %s',
    (id) => {
      expect(ProviderModelId.parse(id)).toBe(id);
    }
  );

  it.each(['', ' ', 'google\n', 'two words', 'go/ogle', 'модель', 42, null])(
    'rejects malformed stored model key %j',
    (key) => {
      expect(AIModelKey.safeParse(key).success).toBe(false);
    }
  );

  it.each(['', ' ', 'model\n', 'two words', 'model/id', 'модель', 42, null])(
    'rejects malformed provider slug %j',
    (id) => {
      expect(ProviderModelId.safeParse(id).success).toBe(false);
    }
  );
});
