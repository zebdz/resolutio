/** Production OTP candidates retain the existing six-digit format. */
import { describe, expect, it } from 'vitest';
import { CryptoOtpCodeGenerator } from '../CryptoOtpCodeGenerator';

describe('generate', () => {
  it('should generate a 6-digit string', () => {
    const code = new CryptoOtpCodeGenerator().generate();
    expect(code.getValue()).toMatch(/^\d{6}$/);
  });

  it('should generate different codes on subsequent calls', () => {
    const codes = new Set<string>();

    for (let i = 0; i < 20; i++) {
      codes.add(new CryptoOtpCodeGenerator().generate().getValue());
    }

    // With 20 random 6-digit codes, duplicates are extremely unlikely
    expect(codes.size).toBeGreaterThan(1);
  });
});
