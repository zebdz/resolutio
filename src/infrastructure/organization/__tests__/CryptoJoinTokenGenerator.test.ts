/** Actual entropy adapter emits the public readable ten-character link format. */
import { describe, expect, it } from 'vitest';
import { CryptoJoinTokenGenerator } from '../CryptoJoinTokenGenerator';
import { JoinTokenValue } from '../../../domain/organization/JoinTokenValues';
describe('CryptoJoinTokenGenerator', () => {
  it('generates a valid public join-link value', () => {
    const token = new CryptoJoinTokenGenerator().generate();
    expect(JoinTokenValue.safeParse(token).success).toBe(true);
  });
});
