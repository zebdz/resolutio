import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

// 10 MB cap. Files are stored inline as Postgres BYTEA; Postgres TOAST keeps
// values >2 KB out of line so this does not slow scans on the parent claim.
export const PROPERTY_CLAIM_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

// Whitelist of accepted upload types — common image formats, PDF, and ZIP
// (a folder of scanned documents bundled together is a frequent shape for
// proof-of-ownership). Adding a type here is intentional; do not loosen
// this set without a security review.
export const PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/zip',
] as const;

export type PropertyClaimAttachmentMimeType =
  (typeof PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

interface CreateInput {
  claimId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface CreateWithBytesInput {
  claimId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

const MAGIC_HEADER_PREFIX_BYTES = 12;

// Magic-number predicates for each allowed MIME type. The user can claim
// any MIME on the form; this function verifies the file's actual leading
// bytes match. Catches the rename-and-lie attack (.exe → .pdf, declared
// as application/pdf). Doesn't catch polyglots — those are mitigated by
// downstream layers (CSP, Content-Disposition: attachment, auth-gated
// download) rather than at upload time.
//
// Reads up to 12 bytes (the WebP check needs offset 0..3 + 8..11). All
// other types check offset 0 only.
function magicMatches(mimeType: string, head: Buffer): boolean {
  switch (mimeType) {
    case 'image/png':
      // 89 50 4E 47 0D 0A 1A 0A — fixed 8-byte PNG signature.
      return (
        head.length >= 8 &&
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47 &&
        head[4] === 0x0d &&
        head[5] === 0x0a &&
        head[6] === 0x1a &&
        head[7] === 0x0a
      );
    case 'image/jpeg':
      // FF D8 FF — start-of-image marker. The 4th byte varies by JPEG variant
      // (FF E0 = JFIF, FF E1 = EXIF, etc.) so don't constrain it here.
      return (
        head.length >= 3 &&
        head[0] === 0xff &&
        head[1] === 0xd8 &&
        head[2] === 0xff
      );
    case 'image/webp':
      // RIFF container with 'WEBP' format tag. RIFF at 0..3, file size at
      // 4..7 (skipped — depends on file size), 'WEBP' at 8..11.
      return (
        head.length >= 12 &&
        head.toString('ascii', 0, 4) === 'RIFF' &&
        head.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'application/pdf':
      // '%PDF-' — strict at offset 0. The PDF spec permits up to 1024 bytes
      // of preamble, but virtually all real-world PDFs start with this
      // marker. Loosen only if false rejections show up.
      return head.length >= 5 && head.toString('ascii', 0, 5) === '%PDF-';
    case 'application/zip':
      // ZIP magic comes in three variants: 03 04 = local file header
      // (real archives with at least one file), 05 06 = empty archive
      // EOCD record, 07 08 = spanned/multi-part. Accept all three.
      return (
        head.length >= 4 &&
        head[0] === 0x50 &&
        head[1] === 0x4b &&
        ((head[2] === 0x03 && head[3] === 0x04) ||
          (head[2] === 0x05 && head[3] === 0x06) ||
          (head[2] === 0x07 && head[3] === 0x08))
      );
    default:
      // Unknown MIME — caller should reject earlier on the whitelist check.
      return false;
  }
}

interface ReconstituteInput {
  id: string;
  claimId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export class PropertyClaimAttachment {
  private constructor(
    public readonly id: string | null,
    public readonly claimId: string,
    public readonly fileName: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    public readonly createdAt: Date | null
  ) {}

  static create(input: CreateInput): Result<PropertyClaimAttachment, string> {
    const trimmed = input.fileName.trim();

    if (trimmed.length === 0) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_FILENAME_EMPTY
      );
    }

    if (input.sizeBytes > PROPERTY_CLAIM_ATTACHMENT_MAX_BYTES) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE
      );
    }

    if (
      !(
        PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]
      ).includes(input.mimeType)
    ) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TYPE_NOT_ALLOWED
      );
    }

    return success(
      new PropertyClaimAttachment(
        null,
        input.claimId,
        trimmed,
        input.mimeType,
        input.sizeBytes,
        null
      )
    );
  }

  // Bytes-aware factory. Runs the same metadata validation as `create` plus
  // a magic-number check against the file's actual leading bytes. Use this
  // in upload paths so a renamed-and-lied-about file (e.g., .exe declared
  // as application/pdf) is rejected before any DB write.
  static createWithBytes(
    input: CreateWithBytesInput
  ): Result<PropertyClaimAttachment, string> {
    // Reuse the metadata-only path for size, mime whitelist, fileName trim.
    // This keeps the validation order: size → type → magic. Returning the
    // size error first is more useful — a 200 MB file is wrong regardless
    // of its declared type.
    const meta = PropertyClaimAttachment.create({
      claimId: input.claimId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
    });

    if (!meta.success) {
      return meta;
    }

    const head = input.bytes.subarray(0, MAGIC_HEADER_PREFIX_BYTES);

    if (!magicMatches(input.mimeType, head)) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_MAGIC_MISMATCH
      );
    }

    return success(meta.value);
  }

  static reconstitute(input: ReconstituteInput): PropertyClaimAttachment {
    return new PropertyClaimAttachment(
      input.id,
      input.claimId,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.createdAt
    );
  }
}
