import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

// Path prefix for inline description refs and the download route.
export const POLL_ATTACHMENT_API_PREFIX = '/api/poll-attachments';

// 5 MB cap for images — guards against RAW/uncompressed uploads.
export const POLL_ATTACHMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// 10 MB cap for PDFs — scanned evidence with embedded fonts can be large.
export const POLL_ATTACHMENT_PDF_MAX_BYTES = 10 * 1024 * 1024;

// Per-poll attachment cap. Enforced in the use case, not in this entity.
export const POLL_ATTACHMENT_COUNT_LIMIT = 20;

// Deliberately narrower than the report whitelist: a poll description takes
// evidence (photos, scanned documents), not office files. Adding a type here
// is intentional; do not loosen without a security review.
export const POLL_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export type PollAttachmentMimeType =
  (typeof POLL_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

// The WebP check needs offset 0..3 plus 8..11; everything else checks
// offset 0 only.
const MAGIC_HEADER_PREFIX_BYTES = 12;

function maxBytesFor(mimeType: string): number {
  return mimeType === 'application/pdf'
    ? POLL_ATTACHMENT_PDF_MAX_BYTES
    : POLL_ATTACHMENT_IMAGE_MAX_BYTES;
}

// Magic-number predicates. The user can claim any MIME on the form; this
// verifies the file's actual leading bytes match. Catches the
// rename-and-lie attack (.exe → .pdf, declared as application/pdf).
// Polyglots are mitigated downstream by the auth-gated download route and
// the renderer's per-poll allowlist rather than at upload time.
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
      // FF D8 FF — start-of-image marker. The 4th byte varies by variant
      // (FF E0 = JFIF, FF E1 = EXIF) so it is not constrained here.
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
      // '%PDF-' strict at offset 0. The spec permits up to 1024 bytes of
      // preamble, but virtually all real PDFs start with this marker.
      return head.length >= 5 && head.toString('ascii', 0, 5) === '%PDF-';
    default:
      // Unknown MIME — the whitelist check rejects earlier.
      return false;
  }
}

interface CreateInput {
  pollId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface CreateWithBytesInput {
  pollId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

interface ReconstituteInput {
  id: string;
  pollId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export class PollAttachment {
  private constructor(
    public readonly id: string | null,
    public readonly pollId: string,
    public readonly fileName: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    public readonly createdAt: Date | null
  ) {}

  static create(input: CreateInput): Result<PollAttachment, string> {
    const trimmed = input.fileName.trim();

    if (trimmed.length === 0) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY);
    }

    if (
      !(POLL_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(
        input.mimeType
      )
    ) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED);
    }

    if (input.sizeBytes > maxBytesFor(input.mimeType)) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE);
    }

    return success(
      new PollAttachment(
        null,
        input.pollId,
        trimmed,
        input.mimeType,
        input.sizeBytes,
        null
      )
    );
  }

  // Bytes-aware factory. Runs the same metadata validation as `create` plus
  // a magic-number check. Use this in upload paths so a renamed-and-lied
  // file is rejected before any DB write. Validation order is filename →
  // type → size → magic, so obviously oversized uploads fail without
  // inspecting their contents.
  static createWithBytes(
    input: CreateWithBytesInput
  ): Result<PollAttachment, string> {
    const meta = PollAttachment.create({
      pollId: input.pollId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
    });

    if (!meta.success) {
      return meta;
    }

    const head = input.bytes.subarray(0, MAGIC_HEADER_PREFIX_BYTES);

    if (!magicMatches(input.mimeType, head)) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH);
    }

    return success(meta.value);
  }

  static reconstitute(input: ReconstituteInput): PollAttachment {
    return new PollAttachment(
      input.id,
      input.pollId,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.createdAt
    );
  }
}
