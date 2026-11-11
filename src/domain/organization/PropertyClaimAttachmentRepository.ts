/** Typed attachment persistence projections. Metadata never contains content bytes;
 * adapters validate stored scalar values before they cross the port. */
import { Instant } from '../shared/Instant';
import {
  PropertyClaimAttachmentId,
  PropertyClaimId,
} from '../shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentByteCount,
} from '../shared/attachments/AttachmentValues';
import { PropertyClaimAttachmentMimeType } from './PropertyClaimAttachment';
import { Result } from '../shared/Result';
import { PropertyClaimAttachment } from './PropertyClaimAttachment';

// Lightweight projection without `bytes` — used by the admin queue UI to
// show fileName / size next to the Download button without round-tripping
// the actual content. Domain entity still represents the metadata; the raw
// bytes live behind a separate `findBytesById` call so we don't accidentally
// stream them to clients that only need to render a list.
export interface PropertyClaimAttachmentMetadata {
  id: PropertyClaimAttachmentId;
  claimId: PropertyClaimId;
  fileName: AttachmentFileName;
  mimeType: PropertyClaimAttachmentMimeType;
  sizeBytes: AttachmentByteCount;
  createdAt: Instant;
}

export interface PropertyClaimAttachmentBytes {
  fileName: AttachmentFileName;
  mimeType: PropertyClaimAttachmentMimeType;
  bytes: Buffer;
}

export interface PropertyClaimAttachmentRepository {
  // Insert a new row with content. The entity carries metadata; bytes are
  // passed separately so the entity itself never holds a Buffer reference
  // (avoids accidental serialisation across the Server→Client boundary).
  save(
    attachment: PropertyClaimAttachment,
    bytes: Buffer
  ): Promise<
    Result<PropertyClaimAttachmentMetadata, 'common.errors.unexpected'>
  >;

  findByClaimId(
    claimId: PropertyClaimId
  ): Promise<
    Result<PropertyClaimAttachmentMetadata[], 'common.errors.unexpected'>
  >;

  // Bytes-bearing fetch — only call from the download route handler,
  // never from a Server Component.
  findBytesById(
    id: PropertyClaimAttachmentId
  ): Promise<
    Result<PropertyClaimAttachmentBytes | null, 'common.errors.unexpected'>
  >;
}
