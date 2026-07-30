import { describe, it, expect } from 'vitest';
import { PollType, parsePollType } from '../PollType';
import { PollDomainCodes } from '../PollDomainCodes';

describe('PollType', () => {
  it('has two values', () => {
    expect(PollType.ORGANIZATION).toBe('ORGANIZATION');
    expect(PollType.OPEN).toBe('OPEN');
  });

  describe('parsePollType', () => {
    it.each(['ORGANIZATION', 'OPEN'])('accepts %s', (v) => {
      const result = parsePollType(v);

      expect(result.success).toBe(true);
      expect(result.value).toBe(v);
    });

    it('rejects unknown values', () => {
      const result = parsePollType('PUBLIC');

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
    });

    it('rejects empty string', () => {
      const result = parsePollType('');

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
    });
  });
});
