/** Report persistence preserves assigned identity/time and validates search totals.
 * Raw adapter values must not create impossible core query results. */
import { ReportTitle, ReportBody } from '@/domain/report/ReportValues';
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { Report } from '@/domain/report/Report';
import { ReportId, OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaReportRepository } from '../PrismaReportRepository';

it.each([-1, 0.5])(
  'rejects an invalid persisted search total %s',
  async (count) => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(count),
      },
    } as unknown as PrismaClient;

    expect(await new PrismaReportRepository(prisma).search({})).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);

it('saves the report identity and timestamps selected before persistence', async () => {
  const creation = testCreation(ReportId, 'report-1');
  const result = Report.create(
    {
      title: ReportTitle.parse('Report'),
      body: ReportBody.parse('Body'),
      organizationId: OrganizationId.parse('org-1'),
      createdById: UserId.parse('user-1'),
      visibility: 'WITHIN_ORG_ONLY',
      boardIds: [],
    },
    creation
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const tx = {
    report: {
      create: vi.fn(async ({ data }) => ({
        id: 'db-generated',
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
        ...data,
      })),
    },
  };
  const prisma = {
    $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  const saved = await new PrismaReportRepository(prisma).create(result.value);
  expect(saved.success && saved.value.id).toBe(creation.id);
  expect(saved.success && saved.value.createdAt.toISOString()).toBe(
    creation.now
  );
  expect(saved.success && saved.value.updatedAt.toISOString()).toBe(
    creation.now
  );
});
