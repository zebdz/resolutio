/** Prisma adapter for validated poll attachment projections.
 * Stored identities/time are retained; storage failures never expose raw exception text. */
import { Instant } from '@/domain/shared/Instant';
import {
  PollAttachmentId,
  PollId,
  QuestionId,
} from '@/domain/shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentCount,
} from '@/domain/shared/attachments/AttachmentValues';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import {
  POLL_ATTACHMENT_COUNT_LIMIT,
  QUESTION_ATTACHMENT_COUNT_LIMIT,
  PollAttachmentMime,
} from '@/domain/poll/PollAttachment';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollAttachment } from '../../domain/poll/PollAttachment';
import {
  AttachmentWriteFailure,
  PollAttachmentRepository,
  PollAttachmentMetadata,
  PollAttachmentBytes,
} from '../../domain/poll/PollAttachmentRepository';

// Metadata-only projection — never select `bytes` here. The download route is
// the only path that should materialize file content.
const METADATA_SELECT = {
  id: true,
  pollId: true,
  questionId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export class PrismaPollAttachmentRepository implements PollAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    attachment: PollAttachment,
    bytes: Buffer
  ): Promise<Result<PollAttachmentMetadata, AttachmentWriteFailure>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockEditablePoll(tx, attachment.pollId))) {
          return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
        }

        const { pollId, questionId } = attachment;

        if (
          questionId &&
          !(await tx.question.findFirst({
            where: { id: questionId, pollId, archivedAt: null },
            select: { id: true },
          }))
        ) {
          return failure(PollDomainCodes.QUESTION_NOT_FOUND);
        }

        const count = await tx.pollAttachment.count({
          where: { pollId, questionId },
        });

        if (
          count >=
          (questionId
            ? QUESTION_ATTACHMENT_COUNT_LIMIT
            : POLL_ATTACHMENT_COUNT_LIMIT)
        ) {
          return failure(
            questionId
              ? PollDomainCodes.QUESTION_ATTACHMENT_LIMIT_REACHED
              : PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
          );
        }

        const created = await tx.pollAttachment.create({
          data: {
            id: attachment.id,
            createdAt: attachment.createdAt,
            pollId,
            questionId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            // Prisma 7 strictly types Bytes as Uint8Array<ArrayBuffer>; Node
            // Buffers may sit on a SharedArrayBuffer (ArrayBufferLike) and get
            // rejected. Copy into a fresh Uint8Array backed by a plain
            // ArrayBuffer so the strict type matches.
            bytes: (() => {
              const ab = new ArrayBuffer(bytes.byteLength);
              new Uint8Array(ab).set(bytes);

              return new Uint8Array(ab);
            })(),
          },
          select: METADATA_SELECT,
        });

        return success(toMetadata(created));
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findByPollId(
    pollId: PollId
  ): Promise<Result<PollAttachmentMetadata[], 'common.errors.unexpected'>> {
    try {
      const rows = await this.prisma.pollAttachment.findMany({
        where: { pollId },
        select: METADATA_SELECT,
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map(toMetadata));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findById(
    id: PollAttachmentId
  ): Promise<
    Result<PollAttachmentMetadata | null, 'common.errors.unexpected'>
  > {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: METADATA_SELECT,
      });

      return success(row === null ? null : toMetadata(row));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findBytesById(
    id: PollAttachmentId
  ): Promise<Result<PollAttachmentBytes | null, 'common.errors.unexpected'>> {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, bytes: true },
      });

      if (!row) {
        return success(null);
      }

      return success({
        fileName: AttachmentFileName.parse(row.fileName),
        mimeType: PollAttachmentMime.parse(row.mimeType),
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async countByPollId(
    pollId: PollId,
    questionId: QuestionId | null = null
  ): Promise<Result<AttachmentCount, 'common.errors.unexpected'>> {
    try {
      const count = await this.prisma.pollAttachment.count({
        where: { pollId, questionId },
      });

      return success(AttachmentCount.parse(count));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async deleteById(
    id: PollAttachmentId
  ): Promise<Result<void, AttachmentWriteFailure>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const file = await tx.pollAttachment.findUnique({
          where: { id },
          select: { pollId: true },
        });

        if (!file) {
          return failure(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
        }

        if (!(await lockEditablePoll(tx, PollId.parse(file.pollId)))) {
          return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
        }

        await tx.pollAttachment.deleteMany({ where: { id } });

        return success(undefined);
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }
}

function toMetadata(
  row: Parameters<typeof PollAttachment.reconstitute>[0]
): PollAttachmentMetadata {
  const attachment = PollAttachment.reconstitute(row);

  return {
    id: attachment.id,
    pollId: attachment.pollId,
    questionId: attachment.questionId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: Instant.fromDate(attachment.createdAt),
  };
}

// Serialize attachment counts and lifecycle changes on the same parent row.
async function lockEditablePoll(tx: Prisma.TransactionClient, id: PollId) {
  const [poll] = await tx.$queryRaw<
    { state: string; archived_at: Date | null }[]
  >`SELECT state,archived_at FROM polls WHERE id=${id} FOR UPDATE`;

  return (
    poll &&
    !poll.archived_at &&
    poll.state !== 'ACTIVE' &&
    poll.state !== 'FINISHED'
  );
}
