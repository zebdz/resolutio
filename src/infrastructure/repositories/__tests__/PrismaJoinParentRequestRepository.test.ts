/** Parent-request persistence preserves domain identity and rejects impossible
 * stored decision states at the aggregate hydration boundary. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaJoinParentRequestRepository } from '../PrismaJoinParentRequestRepository';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
const row = {
  id: 'caller-request',
  childOrgId: 'child',
  parentOrgId: 'parent',
  requestingAdminId: 'actor',
  message: 'Parent request',
  status: 'pending' as const,
  handlingAdminId: null,
  handledAt: null,
  rejectionReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
describe('PrismaJoinParentRequestRepository', () => {
  it('retains caller identity through storage', async () => {
    const create = vi.fn(async ({ data }: { data: Partial<typeof row> }) => ({
      ...row,
      ...data,
      id: data.id ?? 'database-id',
    }));
    const repository = new PrismaJoinParentRequestRepository({
      organizationJoinParentRequest: { create },
    } as any);
    const saved = await repository.save(JoinParentRequest.reconstitute(row));
    expect(saved.id).toBe('caller-request');
    expect(saved.createdAt).toEqual(row.createdAt);
  });
});
