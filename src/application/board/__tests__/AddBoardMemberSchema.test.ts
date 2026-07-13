import { describe, it, expect } from 'vitest';
import { AddBoardMemberSchema } from '../AddBoardMemberSchema';

// Board ids in this app are a mix of UUIDs (legacy rows) and cuids (newer
// rows). These are opaque identifiers the use case validates by lookup, so
// the schema must not constrain their format — only require them to be
// present.
describe('AddBoardMemberSchema', () => {
  const UUID = '73f41f2a-ad79-463a-9661-dde2466dcf08';
  const CUID = 'cmd9k3l4o0000abcd1234efgh';

  it('accepts a UUID board id', () => {
    const result = AddBoardMemberSchema.safeParse({
      boardId: UUID,
      userId: CUID,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a cuid board id', () => {
    const result = AddBoardMemberSchema.safeParse({
      boardId: CUID,
      userId: CUID,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty board id', () => {
    const result = AddBoardMemberSchema.safeParse({
      boardId: '',
      userId: CUID,
    });

    expect(result.success).toBe(false);
  });
});
