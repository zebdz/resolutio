/** Prisma adapter for validated poll attachment projections.
 * Stored identities/time are retained; storage failures never expose raw exception text. */
import { Instant } from '@/domain/shared/Instant';
import { PollAttachmentId, PollId } from '@/domain/shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentCount,
} from '@/domain/shared/attachments/AttachmentValues';
import { PollAttachmentMime } from '@/domain/poll/PollAttachment';
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollAttachment } from '../../domain/poll/PollAttachment';
import {
  PollAttachmentRepository,
  PollAttachmentMetadata,
  PollAttachmentBytes,
} from '../../domain/poll/PollAttachmentRepository';

// Metadata-only projection — never select `bytes` here. The download route is
// the only path that should materialize file content.
const METADATA_SELECT = {
  id: true,
  pollId: true,
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
  ): Promise<Result<PollAttachmentMetadata, 'common.errors.unexpected'>> {
    try {
      const created = await this.prisma.pollAttachment.create({
        data: {
          id: attachment.id,
          createdAt: attachment.createdAt,
          pollId: attachment.pollId,
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
    pollId: PollId
  ): Promise<Result<AttachmentCount, 'common.errors.unexpected'>> {
    try {
      const count = await this.prisma.pollAttachment.count({
        where: { pollId },
      });

      return success(AttachmentCount.parse(count));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async deleteById(
    id: PollAttachmentId
  ): Promise<Result<void, 'common.errors.unexpected'>> {
    try {
      await this.prisma.pollAttachment.delete({ where: { id } });

      return success(undefined);
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
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: Instant.fromDate(attachment.createdAt),
  };
}
