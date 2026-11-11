/** Core collection counts retain their units and reject impossible storage values.
 * Exercise the public repository ports used by limits and organization statistics. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationId, PollId, ReportId } from '@/domain/shared/EntityIds';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaPollAttachmentRepository } from '../PrismaPollAttachmentRepository';
import { PrismaReportAttachmentRepository } from '../PrismaReportAttachmentRepository';
import { PrismaOrganizationPropertyRepository } from '../PrismaOrganizationPropertyRepository';
import { PrismaOrganizationRepository } from '../PrismaOrganizationRepository';

const adapters = [
  {
    name: 'poll attachment',
    count: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaPollAttachmentRepository(db).countByPollId(
          PollId.parse('poll')
        )
      ),
  },
  {
    name: 'report attachment',
    count: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaReportAttachmentRepository(db).countByReportId(
          ReportId.parse('report')
        )
      ),
  },
  {
    name: 'organization property',
    count: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaOrganizationPropertyRepository(db).countNonArchived(
          OrganizationId.parse('org')
        )
      ),
  },
  {
    name: 'organization member',
    count: async (db: PrismaClient) =>
      (
        await new PrismaOrganizationRepository(db).getChildrenWithStats(
          OrganizationId.parse('org')
        )
      )[0].memberCount,
  },
];

function clientWithCount(count: number): PrismaClient {
  const rows = { count: vi.fn().mockResolvedValue(count) };

  return {
    pollAttachment: rows,
    reportAttachment: rows,
    organizationProperty: rows,
    organization: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'child', name: 'Child', _count: { members: count } },
        ]),
    },
  } as unknown as PrismaClient;
}

describe.each(adapters)('$name count boundary', ({ count }) => {
  it.each([0, 2])('accepts a count of %s', async (value) => {
    expect(await count(clientWithCount(value))).toBe(value);
  });
  it.each([-1, 0.5])('rejects an impossible count of %s', async (value) => {
    await expect(count(clientWithCount(value))).rejects.toThrow();
  });
});
