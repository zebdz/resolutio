import { Result } from '../shared/Result';
import { PropertyClaimAttachment } from './PropertyClaimAttachment';

// Lightweight projection without `bytes` — used by the admin queue UI to
// show fileName / size next to the Download button without round-tripping
// the actual content. Domain entity still represents the metadata; the raw
// bytes live behind a separate `findBytesById` call so we don't accidentally
// stream them to clients that only need to render a list.
export interface PropertyClaimAttachmentMetadata {
  id: string;
  claimId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PropertyClaimAttachmentBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface PropertyClaimAttachmentRepository {
  // Insert a new row with content. The entity carries metadata; bytes are
  // passed separately so the entity itself never holds a Buffer reference
  // (avoids accidental serialisation across the Server→Client boundary).
  save(
    attachment: PropertyClaimAttachment,
    bytes: Buffer
  ): Promise<Result<PropertyClaimAttachmentMetadata, string>>;

  findByClaimId(
    claimId: string
  ): Promise<Result<PropertyClaimAttachmentMetadata[], string>>;

  // Bytes-bearing fetch — only call from the download route handler,
  // never from a Server Component.
  findBytesById(
    id: string
  ): Promise<Result<PropertyClaimAttachmentBytes | null, string>>;
}
