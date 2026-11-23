/** Seal identity contracts preserve canonical bytes and reject ambiguous tokens.
 * Each type is tested independently, including the HMAC delimiter and length limit. */
import { describe, expect, it } from 'vitest';
import {
  QuestionId,
  AnswerId,
  PollId,
  UserId,
  OrganizationId,
  BoardId,
  PropertyId,
  AssetId,
  AttachmentId,
  AnchorId,
} from '../SealValues';
import { sealResult } from '../SealDomainCodes';

describe.each(
  Object.entries({
    QuestionId,
    AnswerId,
    PollId,
    UserId,
    OrganizationId,
    BoardId,
    PropertyId,
    AssetId,
    AttachmentId,
    AnchorId,
  })
)('%s', (_name, identity) => {
  it('preserves supported record identifiers byte for byte', () => {
    for (const value of [
      'cmg1234567890abcdefghijklmn',
      '28ed98d3-5911-4d20-a4a5-214249b95372',
      'legacy_record-1',
      'a',
      'a'.repeat(256),
    ]) {
      expect(identity.parse(value)).toBe(value);
    }
  });

  it('rejects malformed values through the seal Result boundary', () => {
    for (const value of [
      '',
      'poll:user',
      'two words',
      'ünicode',
      'a'.repeat(257),
      ' id',
      'id ',
      'id\n',
      'id\r',
      'id\0',
      'path/id',
      null,
      42,
    ]) {
      expect(
        sealResult(() => identity.parse(value)).success,
        String(value)
      ).toBe(false);
    }
  });
});
