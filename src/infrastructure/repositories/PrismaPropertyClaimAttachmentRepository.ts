/** Prisma adapter for validated propertyclaim attachment projections.
 * Stored identities/time are retained; storage failures never expose raw exception text. */
import { Instant } from '@/domain/shared/Instant';
import {
  PropertyClaimAttachmentId,
  PropertyClaimId,
} from '@/domain/shared/EntityIds';
import { AttachmentFileName } from '@/domain/shared/attachments/AttachmentValues';
import { PropertyClaimAttachmentMime } from '@/domain/organization/PropertyClaimAttachment';
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
  ): Promise<
    Result<PropertyClaimAttachmentMetadata, 'common.errors.unexpected'>
  > {
    try {
      const created = await this.prisma.propertyClaimAttachment.create({
        data: {
          id: attachment.id,
          createdAt: attachment.createdAt,
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

      return success(toMetadata(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findByClaimId(
    claimId: PropertyClaimId
  ): Promise<
    Result<PropertyClaimAttachmentMetadata[], 'common.errors.unexpected'>
  > {
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

      return success(rows.map(toMetadata));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findBytesById(
    id: PropertyClaimAttachmentId
  ): Promise<
    Result<PropertyClaimAttachmentBytes | null, 'common.errors.unexpected'>
  > {
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
        fileName: AttachmentFileName.parse(row.fileName),
        mimeType: PropertyClaimAttachmentMime.parse(row.mimeType),
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }
}

function toMetadata(
  row: Parameters<typeof PropertyClaimAttachment.reconstitute>[0]
): PropertyClaimAttachmentMetadata {
  const attachment = PropertyClaimAttachment.reconstitute(row);

  return {
    id: attachment.id,
    claimId: attachment.claimId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: Instant.fromDate(attachment.createdAt),
  };
}
