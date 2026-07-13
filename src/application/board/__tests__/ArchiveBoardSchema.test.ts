import { describe, it, expect } from 'vitest';
import { ArchiveBoardSchema } from '../ArchiveBoardSchema';

// Board ids in this app are a mix of UUIDs (legacy rows) and cuids (newer
// rows). This is an opaque identifier the use case validates by lookup, so
// the schema must not constrain its format — only require it to be present.
describe('ArchiveBoardSchema', () => {
  const UUID = '73f41f2a-ad79-463a-9661-dde2466dcf08';
  const CUID = 'cmd9k3l4o0000abcd1234efgh';

  it('accepts a UUID board id', () => {
    const result = ArchiveBoardSchema.safeParse({
      boardId: UUID,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a cuid board id', () => {
    const result = ArchiveBoardSchema.safeParse({
      boardId: CUID,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty board id', () => {
    const result = ArchiveBoardSchema.safeParse({
      boardId: '',
    });

    expect(result.success).toBe(false);
  });
});
