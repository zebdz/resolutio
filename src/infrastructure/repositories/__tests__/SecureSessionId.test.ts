import { describe, it, expect } from 'vitest';
import { generateSessionId } from '../PrismaSessionRepository';

describe('generateSessionId', () => {
  it('should produce a 64-char hex string (256 bits)', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce unique values on consecutive calls', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});
