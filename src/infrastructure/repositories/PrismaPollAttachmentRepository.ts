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
  ): Promise<Result<PollAttachmentMetadata, string>> {
    try {
      const created = await this.prisma.pollAttachment.create({
        data: {
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

      return success(created);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByPollId(
    pollId: string
  ): Promise<Result<PollAttachmentMetadata[], string>> {
    try {
      const rows = await this.prisma.pollAttachment.findMany({
        where: { pollId },
        select: METADATA_SELECT,
        orderBy: { createdAt: 'asc' },
      });

      return success(rows);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(
    id: string
  ): Promise<Result<PollAttachmentMetadata | null, string>> {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: METADATA_SELECT,
      });

      return success(row);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findBytesById(
    id: string
  ): Promise<Result<PollAttachmentBytes | null, string>> {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, bytes: true },
      });

      if (!row) {
        return success(null);
      }

      return success({
        fileName: row.fileName,
        mimeType: row.mimeType,
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countByPollId(pollId: string): Promise<Result<number, string>> {
    try {
      const count = await this.prisma.pollAttachment.count({
        where: { pollId },
      });

      return success(count);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async deleteById(id: string): Promise<Result<void, string>> {
    try {
      await this.prisma.pollAttachment.delete({ where: { id } });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
