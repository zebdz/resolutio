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
  ): Promise<Result<ReportAttachmentMetadata, string>> {
    try {
      const created = await this.prisma.reportAttachment.create({
        data: {
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

      return success(created);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByReportId(
    reportId: string
  ): Promise<Result<ReportAttachmentMetadata[], string>> {
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

      return success(rows);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findBytesById(
    id: string
  ): Promise<Result<ReportAttachmentBytes | null, string>> {
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
        fileName: row.fileName,
        mimeType: row.mimeType,
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(
    id: string
  ): Promise<Result<ReportAttachmentMetadata | null, string>> {
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

      return success(row ?? null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countByReportId(reportId: string): Promise<Result<number, string>> {
    try {
      const count = await this.prisma.reportAttachment.count({
        where: { reportId },
      });

      return success(count);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async deleteById(id: string): Promise<Result<void, string>> {
    try {
      await this.prisma.reportAttachment.delete({ where: { id } });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
