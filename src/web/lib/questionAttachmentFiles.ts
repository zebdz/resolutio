/** Authorize question file names with the same policy as downloads. Sealed views
 * take the names and question ownership from the verified record. */
import {
  PollId,
  QuestionId,
  PollAttachmentId,
  UserId,
} from '@/domain/shared/EntityIds';
import { prisma } from '@/infrastructure/database/prisma';
import { canReadPollFiles } from '@/infrastructure/repositories/pollFileVisibility';

export type QuestionFile = {
  id: PollAttachmentId;
  questionId: QuestionId;
  fileName: string;
  mimeType: string;
};

export async function questionAttachmentFiles(
  pollId: PollId,
  viewer: UserId,
  frozen?: readonly {
    id: string;
    questionId: string | null;
    fileName: string;
    mimeType: string;
  }[]
): Promise<QuestionFile[]> {
  if (
    frozen?.length === 0 ||
    !(await canReadPollFiles(prisma, pollId, viewer))
  ) {
    return [];
  }

  const files =
    frozen ??
    (await prisma.pollAttachment.findMany({
      where: { pollId, question: { archivedAt: null } },
      select: { id: true, questionId: true, fileName: true, mimeType: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));

  return files
    .filter((file) => file.questionId !== null)
    .map((file) => ({
      id: PollAttachmentId.parse(file.id),
      questionId: QuestionId.parse(file.questionId),
      fileName: file.fileName,
      mimeType: file.mimeType,
    }));
}
