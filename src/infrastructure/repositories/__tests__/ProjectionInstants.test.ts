/** Core read projections expose validated immutable instants, never mutable Dates.
 * Date objects remain an ORM boundary detail; serializers receive canonical UTC values. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  OrganizationId,
  PollId,
  ReportId,
  PropertyClaimId,
} from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaPollAttachmentRepository } from '../PrismaPollAttachmentRepository';
import { PrismaReportAttachmentRepository } from '../PrismaReportAttachmentRepository';
import { PrismaPropertyClaimAttachmentRepository } from '../PrismaPropertyClaimAttachmentRepository';
import { PrismaReportRepository } from '../PrismaReportRepository';
import { PrismaPropertyAssetRepository } from '../PrismaPropertyAssetRepository';

const instant = Instant.parse('2026-01-01T01:02:03.456Z');
const projections = [
  {
    name: 'poll attachment',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaPollAttachmentRepository(db).findByPollId(
          PollId.parse('poll')
        )
      )[0].createdAt,
  },
  {
    name: 'report attachment',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaReportAttachmentRepository(db).findByReportId(
          ReportId.parse('report')
        )
      )[0].createdAt,
  },
  {
    name: 'claim attachment',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaPropertyClaimAttachmentRepository(db).findByClaimId(
          PropertyClaimId.parse('claim')
        )
      )[0].createdAt,
  },
  {
    name: 'report publication',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaReportRepository(db).listPublicAnonForSitemap()
      )[0].lastPublishedAt,
  },
  {
    name: 'ownership start',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaPropertyAssetRepository(db).findOwnershipRows({
          organizationId: OrganizationId.parse('org'),
          activeOnly: false,
        })
      )[0].effectiveFrom,
  },
  {
    name: 'ownership end',
    read: async (db: PrismaClient) =>
      expectSuccess(
        await new PrismaPropertyAssetRepository(db).findOwnershipRows({
          organizationId: OrganizationId.parse('org'),
          activeOnly: false,
        })
      )[0].effectiveUntil,
  },
];

function clientWithDate(date: Date): PrismaClient {
  const file = {
    id: 'file',
    pollId: 'poll',
    reportId: 'report',
    claimId: 'claim',
    fileName: 'x.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 5,
    createdAt: date,
  };
  const files = { findMany: vi.fn().mockResolvedValue([file]) };

  return {
    pollAttachment: files,
    reportAttachment: files,
    propertyClaimAttachment: files,
    report: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'report', lastPublishedAt: date }]),
    },
    propertyAssetOwnership: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'ownership',
          assetId: 'asset',
          userId: null,
          externalOwnerLabel: 'External',
          share: 1,
          effectiveFrom: date,
          effectiveUntil: date,
          createdAt: date,
          asset: {
            name: 'Asset',
            propertyId: 'property',
            property: { name: 'Property' },
          },
          user: null,
        },
      ]),
    },
  } as unknown as PrismaClient;
}

describe.each(projections)('$name time projection', ({ read }) => {
  it('returns an immutable validated instant independent of the ORM Date', async () => {
    const date = Instant.toDate(instant);
    const result = await read(clientWithDate(date));
    date.setUTCFullYear(2000);
    expect(result).toBe(instant);
  });
});
