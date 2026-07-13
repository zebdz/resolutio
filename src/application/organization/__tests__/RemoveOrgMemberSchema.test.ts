import { describe, it, expect } from 'vitest';
import { RemoveOrgMemberSchema } from '../RemoveOrgMemberSchema';

// Organization ids in this app are a mix of UUIDs (legacy rows) and cuids
// (newer rows), and user ids are cuids. These are opaque identifiers the use
// case validates by lookup, so the schema must not constrain their format —
// only require them to be present.
describe('RemoveOrgMemberSchema', () => {
  const UUID_ORG = '73f41f2a-ad79-463a-9661-dde2466dcf08';
  const CUID_ORG = 'cmd9k3l4o0000abcd1234efgh';
  const CUID_USER = 'cmo68ik2j0024g4ij80ou5eq4';

  it('accepts a UUID organization id', () => {
    const result = RemoveOrgMemberSchema.safeParse({
      organizationId: UUID_ORG,
      targetUserId: CUID_USER,
      reason: 'duplicate account',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a cuid organization id', () => {
    const result = RemoveOrgMemberSchema.safeParse({
      organizationId: CUID_ORG,
      targetUserId: CUID_USER,
      reason: 'duplicate account',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty organization id', () => {
    const result = RemoveOrgMemberSchema.safeParse({
      organizationId: '',
      targetUserId: CUID_USER,
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty target user id', () => {
    const result = RemoveOrgMemberSchema.safeParse({
      organizationId: UUID_ORG,
      targetUserId: '',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a blank reason', () => {
    const result = RemoveOrgMemberSchema.safeParse({
      organizationId: UUID_ORG,
      targetUserId: CUID_USER,
      reason: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('trims the reason and rejects reasons longer than 500 characters', () => {
    const ok = RemoveOrgMemberSchema.safeParse({
      organizationId: UUID_ORG,
      targetUserId: CUID_USER,
      reason: '  cleanup  ',
    });

    expect(ok.success).toBe(true);

    if (ok.success) {
      expect(ok.data.reason).toBe('cleanup');
    }

    const tooLong = RemoveOrgMemberSchema.safeParse({
      organizationId: UUID_ORG,
      targetUserId: CUID_USER,
      reason: 'x'.repeat(501),
    });

    expect(tooLong.success).toBe(false);
  });
});
