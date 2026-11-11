/** Stores report aggregates with their assigned identity and lifecycle timestamps.
 * Rehydration validates all persisted values; storage failures expose stable codes. */
import { ReportId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { ResultCount } from '@/domain/shared/Pagination';
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import {
  ReportRepository,
  ReportSearchFilters,
  ReportSearchResult,
} from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export class PrismaReportRepository implements ReportRepository {
  constructor(private prisma: PrismaClient) {}

  async create(
    report: Report
  ): Promise<Result<Report, 'common.errors.unexpected'>> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.report.create({
          data: {
            id: report.id,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            organizationId: report.organizationId,
            createdById: report.createdById,
            title: report.title,
            body: report.body,
            visibility: report.visibility,
            state: report.state,
            publishedById: report.publishedById,
            lastPublishedAt: report.lastPublishedAt,
            notifyAudience: report.notifyAudience,
            archivedAt: report.archivedAt,
          },
        });

        if (report.boardIds.length > 0) {
          await tx.reportBoard.createMany({
            data: report.boardIds.map((boardId) => ({
              reportId: row.id,
              boardId,
            })),
          });
        }

        if (report.pollIds.length > 0) {
          await tx.reportPoll.createMany({
            data: report.pollIds.map((pollId) => ({
              reportId: row.id,
              pollId,
            })),
          });
        }

        return row;
      });

      return success(
        this.hydrate(
          created,
          report.boardIds,
          report.pollIds,
          report.attachmentIds
        )
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async update(
    report: Report
  ): Promise<Result<void, 'common.errors.unexpected'>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.update({
          where: { id: report.id },
          data: {
            updatedAt: report.updatedAt,
            title: report.title,
            body: report.body,
            visibility: report.visibility,
            state: report.state,
            publishedById: report.publishedById,
            lastPublishedAt: report.lastPublishedAt,
            notifyAudience: report.notifyAudience,
            archivedAt: report.archivedAt,
          },
        });
        // Replace boards
        await tx.reportBoard.deleteMany({ where: { reportId: report.id } });

        if (report.boardIds.length > 0) {
          await tx.reportBoard.createMany({
            data: report.boardIds.map((boardId) => ({
              reportId: report.id,
              boardId,
            })),
          });
        }

        // Replace polls
        await tx.reportPoll.deleteMany({ where: { reportId: report.id } });

        if (report.pollIds.length > 0) {
          await tx.reportPoll.createMany({
            data: report.pollIds.map((pollId) => ({
              reportId: report.id,
              pollId,
            })),
          });
        }
      });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findById(
    id: ReportId
  ): Promise<Result<Report | null, 'common.errors.unexpected'>> {
    return this.findByIdWithRelations(id);
  }

  async findByIdWithRelations(
    id: ReportId
  ): Promise<Result<Report | null, 'common.errors.unexpected'>> {
    try {
      const row = await this.prisma.report.findUnique({
        where: { id },
        include: {
          boards: { select: { boardId: true } },
          polls: { select: { pollId: true } },
          attachments: { select: { id: true } },
        },
      });

      if (!row) {
        return success(null);
      }

      return success(
        this.hydrate(
          row,
          row.boards.map((b) => b.boardId),
          row.polls.map((p) => p.pollId),
          row.attachments.map((a) => a.id)
        )
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async listPublicAnonForSitemap(): Promise<
    Result<
      Array<{ id: ReportId; lastPublishedAt: Instant }>,
      'common.errors.unexpected'
    >
  > {
    try {
      const rows = await this.prisma.report.findMany({
        where: {
          visibility: 'PUBLIC_ANON',
          state: 'PUBLISHED',
          archivedAt: null,
          lastPublishedAt: { not: null },
        },
        select: { id: true, lastPublishedAt: true },
        orderBy: { lastPublishedAt: 'desc' },
      });

      return success(
        rows.map((r) => {
          if (r.lastPublishedAt === null) {
            throw new Error('Missing publication timestamp');
          }

          return {
            id: ReportId.parse(r.id),
            lastPublishedAt: Instant.fromDate(r.lastPublishedAt),
          };
        })
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async search(
    filters: ReportSearchFilters
  ): Promise<Result<ReportSearchResult, 'common.errors.unexpected'>> {
    try {
      const where: Prisma.ReportWhereInput = {};

      if (filters.organizationIds && filters.organizationIds.length > 0) {
        where.organizationId = { in: filters.organizationIds };
      }

      if (filters.visibilities && filters.visibilities.length > 0) {
        where.visibility = { in: filters.visibilities };
      }

      if (filters.state) {
        where.state = filters.state;
      }

      if (!filters.includeArchived) {
        where.archivedAt = null;
      }

      if (filters.authorId) {
        where.createdById = filters.authorId;
      }

      if (filters.attachedPollId) {
        where.polls = { some: { pollId: filters.attachedPollId } };
      }

      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      const [rows, totalCount] = await Promise.all([
        this.prisma.report.findMany({
          where,
          orderBy: [{ lastPublishedAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: pageSize,
          include: {
            boards: { select: { boardId: true } },
            polls: { select: { pollId: true } },
            attachments: { select: { id: true } },
          },
        }),
        this.prisma.report.count({ where }),
      ]);

      return success({
        reports: rows.map((row) =>
          this.hydrate(
            row,
            row.boards.map((b) => b.boardId),
            row.polls.map((p) => p.pollId),
            row.attachments.map((a) => a.id)
          )
        ),
        totalCount: ResultCount.parse(totalCount),
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  private hydrate(
    row: {
      id: string;
      organizationId: string;
      createdById: string;
      title: string;
      body: string;
      visibility: string;
      state: string;
      publishedById: string | null;
      lastPublishedAt: Date | null;
      notifyAudience: boolean;
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    },
    boardIds: string[],
    pollIds: string[],
    attachmentIds: string[]
  ): Report {
    return Report.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      createdById: row.createdById,
      title: row.title,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      publishedById: row.publishedById,
      lastPublishedAt: row.lastPublishedAt,
      notifyAudience: row.notifyAudience,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
      boardIds,
      pollIds,
      attachmentIds,
    });
  }
}
