/** Validated poll evidence metadata with caller-assigned identity/time.
 * Content bytes remain separate, so metadata never leaks file content across boundaries. */
import { z } from 'zod';
import { EntityCreation } from '../shared/EntityCreation';
import { PollAttachmentId, PollId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import {
  AttachmentFileName,
  AttachmentByteCount,
  AttachmentCount,
} from '../shared/attachments/AttachmentValues';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';

// Path prefix for inline description refs and the download route.
export { POLL_ATTACHMENT_API_PREFIX } from '../shared/attachments/AttachmentReferenceScope';

// 5 MB cap for images — guards against RAW/uncompressed uploads.
export const POLL_ATTACHMENT_IMAGE_MAX_BYTES = AttachmentByteCount.parse(
  5 * 1024 * 1024
);

// 10 MB cap for PDFs — scanned evidence with embedded fonts can be large.
export const POLL_ATTACHMENT_PDF_MAX_BYTES = AttachmentByteCount.parse(
  10 * 1024 * 1024
);

// Per-poll attachment cap. Enforced in the use case, not in this entity.
export const POLL_ATTACHMENT_COUNT_LIMIT = AttachmentCount.parse(20);

// Deliberately narrower than the report whitelist: a poll description takes
// evidence (photos, scanned documents), not office files. Adding a type here
// is intentional; do not loosen without a security review.
export const POLL_ATTACHMENT_ALLOWED_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const);

export type PollAttachmentMimeType =
  (typeof POLL_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

// The WebP check needs offset 0..3 plus 8..11; everything else checks
// offset 0 only.
export const PollAttachmentMime = z.enum(POLL_ATTACHMENT_ALLOWED_MIME_TYPES);
export type PollAttachmentFailure =
  | PollDomainCode
  | typeof SharedDomainCodes.INVALID_ATTACHMENT_METADATA;

const MAGIC_HEADER_PREFIX_BYTES = 12;

function maxBytesFor(mimeType: PollAttachmentMimeType): AttachmentByteCount {
  return mimeType === 'application/pdf'
    ? POLL_ATTACHMENT_PDF_MAX_BYTES
    : POLL_ATTACHMENT_IMAGE_MAX_BYTES;
}

// Magic-number predicates. The user can claim any MIME on the form; this
// verifies the file's actual leading bytes match. Catches the
// rename-and-lie attack (.exe → .pdf, declared as application/pdf).
// Polyglots are mitigated downstream by the auth-gated download route and
// the renderer's per-poll allowlist rather than at upload time.
function magicMatches(mimeType: PollAttachmentMimeType, head: Buffer): boolean {
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
  pollId: PollId;
  fileName: AttachmentFileName;
  mimeType: PollAttachmentMimeType;
  sizeBytes: AttachmentByteCount;
}

interface CreateWithBytesInput {
  pollId: PollId;
  fileName: AttachmentFileName;
  mimeType: PollAttachmentMimeType;
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

/** Decodes raw upload metadata with this context's established error order.
 * Factories consume validated values and still enforce byte signatures and parent identity. */
export function parsePollAttachmentMetadata(input: {
  fileName: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
}): Result<Omit<CreateInput, 'pollId'>, PollAttachmentFailure> {
  const fileName = AttachmentFileName.safeParse(input.fileName);

  if (!fileName.success) {
    return failure(PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY);
  }

  const mime = PollAttachmentMime.safeParse(input.mimeType);

  if (!mime.success) {
    return failure(PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED);
  }

  if (
    typeof input.sizeBytes === 'number' &&
    input.sizeBytes > maxBytesFor(mime.data)
  ) {
    return failure(PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE);
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

export class PollAttachment {
  private constructor(
    public readonly id: PollAttachmentId,
    public readonly pollId: PollId,
    public readonly fileName: AttachmentFileName,
    public readonly mimeType: PollAttachmentMimeType,
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
    creation: EntityCreation<PollAttachmentId>
  ): Result<PollAttachment, PollAttachmentFailure> {
    const metadata = parsePollAttachmentMetadata(input);

    if (!metadata.success) {
      return metadata;
    }

    const identity = PollAttachmentId.safeParse(creation?.id);
    const parent = PollId.safeParse(input.pollId);
    const time = Instant.safeParse(creation?.now);

    if (!identity.success || !parent.success || !time.success) {
      return failure(SharedDomainCodes.INVALID_ATTACHMENT_METADATA);
    }

    return success(
      new PollAttachment(
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
  // a magic-number check. Use this in upload paths so a renamed-and-lied
  // file is rejected before any DB write. Validation order is filename →
  // type → size → magic, so obviously oversized uploads fail without
  // inspecting their contents.
  static createWithBytes(
    input: CreateWithBytesInput,
    creation: EntityCreation<PollAttachmentId>
  ): Result<PollAttachment, PollAttachmentFailure> {
    const meta = PollAttachment.create(
      {
        pollId: input.pollId,
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
      return failure(PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH);
    }

    return success(meta.value);
  }

  static reconstitute(input: ReconstituteInput): PollAttachment {
    const metadata = parsePollAttachmentMetadata(input);

    if (!metadata.success) {
      throw new Error(metadata.error);
    }

    const result = PollAttachment.create(
      {
        pollId: PollId.parse(input.pollId),
        fileName: metadata.value.fileName,
        mimeType: metadata.value.mimeType,
        sizeBytes: metadata.value.sizeBytes,
      },
      {
        id: PollAttachmentId.parse(input.id),
        now: Instant.fromDate(input.createdAt),
      }
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.value;
  }
}
