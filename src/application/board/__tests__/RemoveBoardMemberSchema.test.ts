import { describe, it, expect } from 'vitest';
import { RemoveBoardMemberSchema } from '../RemoveBoardMemberSchema';

// Board ids in this app are a mix of UUIDs (legacy rows) and cuids (newer
// rows). These are opaque identifiers the use case validates by lookup, so
// the schema must not constrain their format — only require them to be
// present.
describe('RemoveBoardMemberSchema', () => {
  const UUID = '73f41f2a-ad79-463a-9661-dde2466dcf08';
  const CUID = 'cmd9k3l4o0000abcd1234efgh';

  it('accepts a UUID board id', () => {
    const result = RemoveBoardMemberSchema.safeParse({
      boardId: UUID,
      userId: CUID,
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a cuid board id', () => {
    const result = RemoveBoardMemberSchema.safeParse({
      boardId: CUID,
      userId: CUID,
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty board id', () => {
    const result = RemoveBoardMemberSchema.safeParse({
      boardId: '',
      userId: CUID,
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);
  });
});
