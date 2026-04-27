import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyClaimAttachment } from '../../domain/organization/PropertyClaimAttachment';
import {
  PropertyClaimAttachmentRepository,
  PropertyClaimAttachmentMetadata,
  PropertyClaimAttachmentBytes,
} from '../../domain/organization/PropertyClaimAttachmentRepository';

export class PrismaPropertyClaimAttachmentRepository implements PropertyClaimAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    attachment: PropertyClaimAttachment,
    bytes: Buffer
  ): Promise<Result<PropertyClaimAttachmentMetadata, string>> {
    try {
      const created = await this.prisma.propertyClaimAttachment.create({
        data: {
          claimId: attachment.claimId,
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
          claimId: true,
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

  async findByClaimId(
    claimId: string
  ): Promise<Result<PropertyClaimAttachmentMetadata[], string>> {
    try {
      const rows = await this.prisma.propertyClaimAttachment.findMany({
        where: { claimId },
        // Metadata-only projection — never select `bytes` here. The download
        // route is the only path that should materialize the file content.
        select: {
          id: true,
          claimId: true,
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
  ): Promise<Result<PropertyClaimAttachmentBytes | null, string>> {
    try {
      const row = await this.prisma.propertyClaimAttachment.findUnique({
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
}
