/** Nickname entropy stays in the infrastructure adapter with the existing public format. */
import { describe, expect, it } from 'vitest';
import { CryptoNicknameGenerator } from '../CryptoNicknameGenerator';

describe('generate', () => {
  it('should generate a nickname starting with user_', () => {
    const nickname = new CryptoNicknameGenerator().generate();
    expect(nickname.getValue()).toMatch(/^user_[a-z0-9]{8}$/);
  });

  it('should generate unique nicknames', () => {
    const nicknames = new Set<string>();

    for (let i = 0; i < 100; i++) {
      nicknames.add(new CryptoNicknameGenerator().generate().getValue());
    }

    expect(nicknames.size).toBe(100);
  });
});
