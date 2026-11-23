/** Each application identity preserves supported stored tokens and rejects malformed input.
 * The shared constructor must honor the caller's syntax without imposing its own format. */
import { describe, expect, it } from 'vitest';
import { identifier } from '../Identifier';
import * as identities from '../EntityIds';

describe.each(Object.entries(identities))('%s', (_name, identity) => {
  it('preserves supported opaque, CUID and UUID identities', () => {
    for (const value of [
      'cmg1234567890abcdefghijklmn',
      '28ed98d3-5911-4d20-a4a5-214249b95372',
      'legacy_user-1',
      'a',
      'a'.repeat(256),
    ]) {
      expect(identity.parse(value)).toBe(value);
    }
  });

  it('rejects malformed identities without normalizing them', () => {
    for (const value of [
      '',
      'two words',
      'poll:user',
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
      expect(identity.safeParse(value).success, String(value)).toBe(false);
    }
  });
});

describe('caller-owned identity formats', () => {
  it("accepts each type's format, including syntax outside application entity IDs", () => {
    const OrganizationCode = identifier(
      'ContractOrganizationCode',
      /^ORG:[0-9]{4}$/
    );
    const UserCode = identifier('ContractUserCode', /^USR_[A-Z]{3}$/);

    expect(OrganizationCode.parse('ORG:0042')).toBe('ORG:0042');
    expect(UserCode.parse('USR_ABC')).toBe('USR_ABC');
  });

  it("rejects tokens belonging to another type's format", () => {
    const OrganizationCode = identifier(
      'ContractOrganizationCode',
      /^ORG_[0-9]{4}$/
    );
    const UserCode = identifier('ContractUserCode', /^USR_[A-Z]{3}$/);

    expect(OrganizationCode.safeParse('USR_ABC').success).toBe(false);
    expect(UserCode.safeParse('ORG_0042').success).toBe(false);
    expect(UserCode.safeParse('USR_AB').success).toBe(false);
  });
});
