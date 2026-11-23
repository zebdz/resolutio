/** Search adapters decode database totals before exposing core query results.
 * Empty results remain valid; corrupt counts never cross the persistence port. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { PrismaOrganizationRepository } from '../PrismaOrganizationRepository';
import { PrismaJoinTokenRepository } from '../PrismaJoinTokenRepository';

const adapters = [
  {
    name: 'poll',
    search: async (client: PrismaClient) =>
      expectSuccess(await new PrismaPollRepository(client).searchPolls({})),
  },
  {
    name: 'organization',
    search: (client: PrismaClient) =>
      new PrismaOrganizationRepository(client).searchOrganizationsWithStats({}),
  },
  {
    name: 'join token',
    search: (client: PrismaClient) =>
      new PrismaJoinTokenRepository(client).findByOrganizationId(
        OrganizationId.parse('org'),
        {}
      ),
  },
];

function clientWithCount(totalCount: number): PrismaClient {
  const rows = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(totalCount),
  };

  return {
    poll: rows,
    organization: rows,
    organizationJoinToken: rows,
  } as unknown as PrismaClient;
}

describe.each(adapters)('$name search count boundary', ({ search }) => {
  it.each([0, 3])('returns a validated total of %s', async (totalCount) => {
    const result = await search(clientWithCount(totalCount));
    expect(result.totalCount).toBe(totalCount);
  });

  it.each([-1, 0.5])(
    'rejects an impossible total of %s',
    async (totalCount) => {
      await expect(search(clientWithCount(totalCount))).rejects.toThrow();
    }
  );
});
