/** Prisma adapter for validated report attachment projections.
 * Stored identities/time are retained; storage failures never expose raw exception text. */
import { Instant } from '@/domain/shared/Instant';
import { ReportAttachmentId, ReportId } from '@/domain/shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentCount,
} from '@/domain/shared/attachments/AttachmentValues';
import { ReportAttachmentMime } from '@/domain/report/ReportAttachment';
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { ReportAttachment } from '../../domain/report/ReportAttachment';
import {
  ReportAttachmentRepository,
  ReportAttachmentMetadata,
  ReportAttachmentBytes,
} from '../../domain/report/ReportAttachmentRepository';

export class PrismaReportAttachmentRepository implements ReportAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    attachment: ReportAttachment,
    bytes: Buffer
  ): Promise<Result<ReportAttachmentMetadata, 'common.errors.unexpected'>> {
    try {
      const created = await this.prisma.reportAttachment.create({
        data: {
          id: attachment.id,
          createdAt: attachment.createdAt,
          reportId: attachment.reportId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          // Prisma 7 strictly types Bytes as Uint8Array<ArrayBuffer>;
          // Node Buffers may sit on a SharedArrayBuffer (ArrayBufferLike) and
          // get rejected. Copy into a fresh Uint8Array backed by a plain
          // ArrayBuffer so the strict type matches.
          bytes: (() => {
            const ab = new ArrayBuffer(bytes.byteLength);
            new Uint8Array(ab).set(bytes);

            return new Uint8Array(ab);
          })(),
        },
        select: {
          id: true,
          reportId: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      return success(toMetadata(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findByReportId(
    reportId: ReportId
  ): Promise<Result<ReportAttachmentMetadata[], 'common.errors.unexpected'>> {
    try {
      const rows = await this.prisma.reportAttachment.findMany({
        where: { reportId },
        // Metadata-only projection — never select `bytes` here. The download
        // route is the only path that should materialize the file content.
        select: {
          id: true,
          reportId: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map(toMetadata));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findBytesById(
    id: ReportAttachmentId
  ): Promise<Result<ReportAttachmentBytes | null, 'common.errors.unexpected'>> {
    try {
      const row = await this.prisma.reportAttachment.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, bytes: true },
      });

      if (!row) {
        return success(null);
      }

      // Prisma returns Bytes as a Uint8Array — normalise to Buffer so callers
      // can hand it straight to a Response body.
      return success({
        fileName: AttachmentFileName.parse(row.fileName),
        mimeType: ReportAttachmentMime.parse(row.mimeType),
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findById(
    id: ReportAttachmentId
  ): Promise<
    Result<ReportAttachmentMetadata | null, 'common.errors.unexpected'>
  > {
    try {
      const row = await this.prisma.reportAttachment.findUnique({
        where: { id },
        select: {
          id: true,
          reportId: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      return success(row === null ? null : toMetadata(row));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async countByReportId(
    reportId: ReportId
  ): Promise<Result<AttachmentCount, 'common.errors.unexpected'>> {
    try {
      const count = await this.prisma.reportAttachment.count({
        where: { reportId },
      });

      return success(AttachmentCount.parse(count));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async deleteById(
    id: ReportAttachmentId
  ): Promise<Result<void, 'common.errors.unexpected'>> {
    try {
      await this.prisma.reportAttachment.delete({ where: { id } });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }
}

function toMetadata(
  row: Parameters<typeof ReportAttachment.reconstitute>[0]
): ReportAttachmentMetadata {
  const attachment = ReportAttachment.reconstitute(row);

  return {
    id: attachment.id,
    reportId: attachment.reportId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: Instant.fromDate(attachment.createdAt),
  };
}
