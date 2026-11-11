/** Validated report evidence metadata with caller-assigned identity/time.
 * Content bytes remain separate, so metadata never leaks file content across boundaries. */
import { z } from 'zod';
import { EntityCreation } from '../shared/EntityCreation';
import { ReportAttachmentId, ReportId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import {
  AttachmentFileName,
  AttachmentByteCount,
  AttachmentCount,
} from '../shared/attachments/AttachmentValues';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { Result, success, failure } from '../shared/Result';
import { ReportDomainCodes, ReportDomainCode } from './ReportDomainCodes';

// 5 MB cap for images. Files are stored in object storage; this prevents
// accidental upload of RAW/uncompressed images that would balloon storage.
export const REPORT_ATTACHMENT_IMAGE_MAX_BYTES = AttachmentByteCount.parse(
  5 * 1024 * 1024
);

// 10 MB cap for PDFs. PDF/A archives with embedded fonts can be large;
// 10 MB is generous while still guarding against abuse.
export const REPORT_ATTACHMENT_PDF_MAX_BYTES = AttachmentByteCount.parse(
  10 * 1024 * 1024
);

// Per-report attachment cap. Enforced in the use case, not in this entity.
export const REPORT_ATTACHMENT_COUNT_LIMIT = AttachmentCount.parse(20);

// Whitelist of accepted upload types — common image formats, PDF, Excel
// (legacy .xls + modern .xlsx), Word (legacy .doc + modern .docx), and
// LibreOffice/OpenDocument (.odt + .ods). Generic ZIP is not allowed; the
// OOXML / ODF ZIP signature is accepted only when the declared MIME is
// one of the listed subtypes. Polyglots between ZIP-based office formats
// are mitigated by Content-Disposition: attachment.
// Adding a type here is intentional; do not loosen without a security review.
export const REPORT_ATTACHMENT_ALLOWED_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
] as const);

export type ReportAttachmentMimeType =
  (typeof REPORT_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

export const ReportAttachmentMime = z.enum(
  REPORT_ATTACHMENT_ALLOWED_MIME_TYPES
);
export type ReportAttachmentFailure =
  | ReportDomainCode
  | typeof SharedDomainCodes.INVALID_ATTACHMENT_METADATA;

const MAGIC_HEADER_PREFIX_BYTES = 12;

function maxBytesFor(mimeType: ReportAttachmentMimeType): AttachmentByteCount {
  // PDFs, Excel/ODS spreadsheets, and Word/ODT documents share the larger
  // document cap; images get the smaller image cap.
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/msword' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.oasis.opendocument.text' ||
    mimeType === 'application/vnd.oasis.opendocument.spreadsheet'
  ) {
    return REPORT_ATTACHMENT_PDF_MAX_BYTES;
  }

  return REPORT_ATTACHMENT_IMAGE_MAX_BYTES;
}

// Magic-number predicates for each allowed MIME type. The user can claim
// any MIME on the form; this function verifies the file's actual leading
// bytes match. Catches the rename-and-lie attack (.exe → .pdf, declared
// as application/pdf). Doesn't catch polyglots — those are mitigated by
// downstream layers (CSP, Content-Disposition: attachment, auth-gated
// download) rather than at upload time.
//
// Reads up to 12 bytes (the WebP check needs offset 0..3 + 8..11). All
// other types check offset 0 only.
function magicMatches(
  mimeType: ReportAttachmentMimeType,
  head: Buffer
): boolean {
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
    case 'application/vnd.ms-excel':
    case 'application/msword':
      // OLE2 compound document signature: D0 CF 11 E0 A1 B1 1A E1.
      // Shared by legacy Office binary formats — the declared MIME pins the
      // subtype.
      return (
        head.length >= 8 &&
        head[0] === 0xd0 &&
        head[1] === 0xcf &&
        head[2] === 0x11 &&
        head[3] === 0xe0 &&
        head[4] === 0xa1 &&
        head[5] === 0xb1 &&
        head[6] === 0x1a &&
        head[7] === 0xe1
      );
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.oasis.opendocument.text':
    case 'application/vnd.oasis.opendocument.spreadsheet':
      // ZIP local-file-header signature: 50 4B 03 04 (PK\x03\x04).
      // Shared by all OOXML / ODF / generic ZIP — the declared MIME pins
      // the subtype.
      return (
        head.length >= 4 &&
        head[0] === 0x50 &&
        head[1] === 0x4b &&
        head[2] === 0x03 &&
        head[3] === 0x04
      );
    default:
      // Unknown MIME — caller should reject earlier on the whitelist check.
      return false;
  }
}

interface CreateInput {
  reportId: ReportId;
  fileName: AttachmentFileName;
  mimeType: ReportAttachmentMimeType;
  sizeBytes: AttachmentByteCount;
}

interface CreateWithBytesInput {
  reportId: ReportId;
  fileName: AttachmentFileName;
  mimeType: ReportAttachmentMimeType;
  bytes: Buffer;
}

interface ReconstituteInput {
  id: string;
  reportId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/** Decodes raw upload metadata with this context's established error order.
 * Factories consume validated values and still enforce byte signatures and parent identity. */
export function parseReportAttachmentMetadata(input: {
  fileName: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
}): Result<Omit<CreateInput, 'reportId'>, ReportAttachmentFailure> {
  const fileName = AttachmentFileName.safeParse(input.fileName);

  if (!fileName.success) {
    return failure(ReportDomainCodes.REPORT_ATTACHMENT_FILENAME_EMPTY);
  }

  const mime = ReportAttachmentMime.safeParse(input.mimeType);

  if (!mime.success) {
    return failure(ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED);
  }

  if (
    typeof input.sizeBytes === 'number' &&
    input.sizeBytes > maxBytesFor(mime.data)
  ) {
    return failure(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
  }

  const bytes = AttachmentByteCount.safeParse(input.sizeBytes);

  if (!bytes.success) {
    return failure(SharedDomainCodes.INVALID_ATTACHMENT_METADATA);
  }

  return success({
    fileName: AttachmentFileName.parse(fileName.data.trim()),
    mimeType: mime.data,
    sizeBytes: bytes.data,
  });
}

export class ReportAttachment {
  private constructor(
    public readonly id: ReportAttachmentId,
    public readonly reportId: ReportId,
    public readonly fileName: AttachmentFileName,
    public readonly mimeType: ReportAttachmentMimeType,
    public readonly sizeBytes: AttachmentByteCount,
    private readonly created: Instant
  ) {
    Object.freeze(this);
  }

  get createdAt(): Date {
    return Instant.toDate(this.created);
  }

  static create(
    input: CreateInput,
    creation: EntityCreation<ReportAttachmentId>
  ): Result<ReportAttachment, ReportAttachmentFailure> {
    const metadata = parseReportAttachmentMetadata(input);

    if (!metadata.success) {
      return metadata;
    }

    const identity = ReportAttachmentId.safeParse(creation?.id);
    const parent = ReportId.safeParse(input.reportId);
    const time = Instant.safeParse(creation?.now);

    if (!identity.success || !parent.success || !time.success) {
      return failure(SharedDomainCodes.INVALID_ATTACHMENT_METADATA);
    }

    return success(
      new ReportAttachment(
        identity.data,
        parent.data,
        metadata.value.fileName,
        metadata.value.mimeType,
        metadata.value.sizeBytes,
        time.data
      )
    );
  }

  // Bytes-aware factory. Runs the same metadata validation as `create` plus
  // a magic-number check against the file's actual leading bytes. Use this
  // in upload paths so a renamed-and-lied-about file (e.g., .exe declared
  // as application/pdf) is rejected before any DB write.
  static createWithBytes(
    input: CreateWithBytesInput,
    creation: EntityCreation<ReportAttachmentId>
  ): Result<ReportAttachment, ReportAttachmentFailure> {
    // Reuse the metadata-only path for type, fileName trim, and size.
    // Validation order: filename → type → size → magic. Returning the
    // size error before magic avoids reading file bytes for obviously
    // oversized uploads.
    const meta = ReportAttachment.create(
      {
        reportId: input.reportId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: AttachmentByteCount.parse(input.bytes.length),
      },
      creation
    );

    if (!meta.success) {
      return meta;
    }

    const head = input.bytes.subarray(0, MAGIC_HEADER_PREFIX_BYTES);

    if (!magicMatches(meta.value.mimeType, head)) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
    }

    return success(meta.value);
  }

  static reconstitute(input: ReconstituteInput): ReportAttachment {
    const metadata = parseReportAttachmentMetadata(input);

    if (!metadata.success) {
      throw new Error(metadata.error);
    }

    const result = ReportAttachment.create(
      {
        reportId: ReportId.parse(input.reportId),
        fileName: metadata.value.fileName,
        mimeType: metadata.value.mimeType,
        sizeBytes: metadata.value.sizeBytes,
      },
      {
        id: ReportAttachmentId.parse(input.id),
        now: Instant.fromDate(input.createdAt),
      }
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.value;
  }
}
