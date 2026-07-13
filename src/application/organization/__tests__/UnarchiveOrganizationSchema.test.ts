import { describe, it, expect } from 'vitest';
import { UnarchiveOrganizationSchema } from '../UnarchiveOrganizationSchema';

// Organization ids in this app are a mix of UUIDs (legacy rows) and cuids
// (newer rows). This is an opaque identifier the use case validates by
// lookup, so the schema must not constrain its format — only require it to
// be present.
describe('UnarchiveOrganizationSchema', () => {
  const UUID = '73f41f2a-ad79-463a-9661-dde2466dcf08';
  const CUID = 'cmd9k3l4o0000abcd1234efgh';

  it('accepts a UUID organization id', () => {
    const result = UnarchiveOrganizationSchema.safeParse({
      organizationId: UUID,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a cuid organization id', () => {
    const result = UnarchiveOrganizationSchema.safeParse({
      organizationId: CUID,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty organization id', () => {
    const result = UnarchiveOrganizationSchema.safeParse({
      organizationId: '',
    });

    expect(result.success).toBe(false);
  });
});
