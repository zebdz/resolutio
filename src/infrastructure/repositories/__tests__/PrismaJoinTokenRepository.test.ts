/** Join-token persistence preserves domain-assigned identity and validates raw
 * database values before they become a loaded aggregate. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaJoinTokenRepository } from '../PrismaJoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
const row = {
  id: 'caller-id',
  organizationId: 'org',
  createdById: 'actor',
  description: 'Lobby',
  token: 'abc234defg',
  maxUses: null,
  useCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  expiredAt: null,
};
describe('PrismaJoinTokenRepository', () => {
  it('round-trips the domain-assigned identity through storage', async () => {
    const create = vi.fn(async ({ data }: { data: Partial<typeof row> }) => ({
      ...row,
      ...data,
      id: data.id ?? 'generated-by-database',
    }));
    const repository = new PrismaJoinTokenRepository({
      organizationJoinToken: { create },
    } as any);
    const saved = await repository.save(JoinToken.reconstitute(row));
    expect(saved.id).toBe('caller-id');
    expect(saved.createdAt).toEqual(row.createdAt);
  });
});
