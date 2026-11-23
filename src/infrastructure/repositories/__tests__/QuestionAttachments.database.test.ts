/** Real PostgreSQL writers contend for the third slot and synchronize with poll activation. */
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { pollDatabase } from './pollDatabase';
import { PrismaPollAttachmentRepository } from '../PrismaPollAttachmentRepository';
import {
  PollId,
  QuestionId,
  PollAttachmentId,
} from '@/domain/shared/EntityIds';
import {
  PollAttachment,
  PollAttachmentMime,
} from '@/domain/poll/PollAttachment';
import { AttachmentFileName } from '@/domain/shared/attachments/AttachmentValues';
import { Instant } from '@/domain/shared/Instant';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
let db: Awaited<ReturnType<typeof pollDatabase>>;
beforeAll(async () => {
  db = await pollDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
it('keeps all three question slots independent of description files and freezes writes when voting starts', async () => {
  const tag = randomUUID();
  const user = await db.prisma.user.create({
    data: {
      firstName: 'Author',
      lastName: 'Fixture',
      nickname: tag,
      phoneNumber: tag,
      password: 'fixture',
    },
  });
  const org = await db.prisma.organization.create({
    data: { createdById: user.id, name: tag, description: 'Fixture' },
  });
  const create = () =>
    db.prisma.poll.create({
      data: {
        createdBy: user.id,
        organizationId: org.id,
        title: 'Agenda',
        description: 'Agenda',
        startDate: new Date(0),
        endDate: new Date(1000),
        questions: { create: { text: 'Choice' } },
      },
      include: { questions: true },
    });
  const first = await create();
  const other = await create();
  const repo = new PrismaPollAttachmentRepository(db.prisma);
  const bytes = Buffer.from('%PDF-test');
  const save = (question: string | null) =>
    repo.save(
      expectSuccess(
        PollAttachment.createWithBytes(
          {
            pollId: PollId.parse(first.id),
            questionId: QuestionId.nullable().parse(question),
            fileName: AttachmentFileName.parse('agenda.pdf'),
            mimeType: PollAttachmentMime.parse('application/pdf'),
            bytes,
          },
          {
            id: PollAttachmentId.parse(randomUUID()),
            now: Instant.fromDate(new Date()),
          }
        )
      ),
      bytes
    );
  const q = first.questions[0].id;
  const attempts = await Promise.all(Array.from({ length: 5 }, () => save(q)));
  expect(attempts.filter((r) => r.success)).toHaveLength(3);
  expect(attempts.filter((r) => !r.success).map((r) => r.error)).toEqual(
    Array(2).fill('domain.poll.questionAttachmentLimitReached')
  );
  expect(await save(other.questions[0].id)).toMatchObject({
    success: false,
    error: 'domain.poll.questionNotFound',
  });
  const description = expectSuccess(await save(null));
  expect(description.questionId).toBeNull();
  await db.prisma.poll.update({
    where: { id: first.id },
    data: { state: 'ACTIVE' },
  });
  expect(await save(null)).toMatchObject({
    success: false,
    error: 'domain.poll.cannotChangeAttachmentsActive',
  });
  expect(await repo.deleteById(description.id)).toMatchObject({
    success: false,
    error: 'domain.poll.cannotChangeAttachmentsActive',
  });
});
