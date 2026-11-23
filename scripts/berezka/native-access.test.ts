/** Read the published rehearsal through the production poll and report use cases.
 * Explicit local rehearsal URL keeps this opt-in suite independent of the developer database. */
import { it, expect } from 'vitest';
import { UserId, PollId } from '@/domain/shared/EntityIds';
import { questionAttachmentFiles } from '@/web/lib/questionAttachmentFiles';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { PrismaPollRepository } from '@/infrastructure/repositories/PrismaPollRepository';
import { PrismaReportRepository } from '@/infrastructure/repositories/PrismaReportRepository';
import { PrismaReportAttachmentRepository } from '@/infrastructure/repositories/PrismaReportAttachmentRepository';
import { PrismaOrganizationRepository } from '@/infrastructure/repositories/PrismaOrganizationRepository';
import { PrismaUserRepository } from '@/infrastructure/repositories/PrismaUserRepository';
import { PrismaBoardRepository } from '@/infrastructure/repositories/PrismaBoardRepository';
import { PrismaParticipantRepository } from '@/infrastructure/repositories/PrismaParticipantRepository';
import { PrismaVoteRepository } from '@/infrastructure/repositories/PrismaVoteRepository';

it.skipIf(!process.env.BEREZKA_PUBLISHED_URL)(
  'reads all migrated aggregates and applies native membership to board results and protocols',
  async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.BEREZKA_PUBLISHED_URL,
      }),
    });

    try {
      const org = new PrismaOrganizationRepository(prisma);
      const user = new PrismaUserRepository(prisma);
      const poll = new PrismaPollRepository(prisma);
      const results = new GetPollResultsUseCase(
        poll,
        new PrismaParticipantRepository(prisma),
        new PrismaVoteRepository(prisma),
        org,
        user
      );
      const reports = new GetReportForViewerUseCase(
        new PrismaReportRepository(prisma),
        new ResolveReportVisibilityService(
          org,
          new PrismaBoardRepository(prisma),
          user
        ),
        new PrismaReportAttachmentRepository(prisma),
        poll
      );
      const [member, board] = await prisma.$queryRaw<
        { user_id: string }[]
      >`select user_id from berezka.accounts where legacy_id in (94,5) order by legacy_id desc`;
      const meetings = await prisma.poll.findMany({
        where: { organizationId: 'berezka-company-1' },
        select: { id: true, boardId: true },
      });
      expect(meetings.length).toBe(26);

      for (const meeting of meetings) {
        const permitted = await results.execute({
          pollId: meeting.id,
          userId: member.user_id,
        });
        expect(permitted.success).toBe(true);
      }

      const scoped = meetings.find((p) => p.boardId);
      expect(
        (
          await results.execute({
            pollId: scoped!.id,
            userId: 'outside-rehearsal',
          })
        ).success
      ).toBe(false);
      const withBoardFiles = await prisma.poll.findFirstOrThrow({
        where: {
          organizationId: 'berezka-company-1',
          boardId: { not: null },
          attachments: { some: { questionId: { not: null } } },
        },
      });
      const pollId = PollId.parse(withBoardFiles.id);
      const boardFiles = await questionAttachmentFiles(
        pollId,
        UserId.parse(board.user_id)
      );
      expect(boardFiles.length).toBeGreaterThan(0);
      expect(
        await questionAttachmentFiles(pollId, UserId.parse(member.user_id))
      ).toEqual([]);
      expect(
        await questionAttachmentFiles(
          pollId,
          UserId.parse(member.user_id),
          boardFiles
        )
      ).toEqual([]);
      const rows = await prisma.report.findMany({
        where: { organizationId: 'berezka-company-1' },
        select: { id: true, visibility: true },
      });
      expect(rows.length).toBe(364);

      for (const { id, visibility } of rows) {
        const viewerId =
          visibility === 'WITHIN_BOARDS' ? board.user_id : member.user_id;
        expect(
          (await reports.execute({ reportId: id, viewerId })).success
        ).toBe(true);
        expect(
          (await reports.execute({ reportId: id, viewerId: null })).success
        ).toBe(false);

        if (visibility === 'WITHIN_BOARDS') {
          expect(
            (await reports.execute({ reportId: id, viewerId: member.user_id }))
              .success
          ).toBe(false);
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  },
  120000
);
