# Poll Description Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a poll author embed images and PDFs inline in a poll description (now 10 000 characters) using markdown, reusing the attachment machinery that organization reports already have.

**Architecture:** A new `PollAttachment` aggregate stores files as Postgres `bytea`, exactly like `ReportAttachment`. The description becomes markdown, rendered by the report renderer generalized into a shared component parameterized by API path prefix. Images render inline; PDFs render as download links. Files are served only through an auth-checked route handler — never from disk, never from nginx's static path.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma 7 + PostgreSQL, Vitest, Tailwind + Catalyst, next-intl, react-markdown + remark-gfm + rehype-sanitize, `@uiw/react-md-editor`.

**Spec:** `readmes/2026-08-08-poll-description-media-design.md`

## Global Constraints

- **Never `git commit`.** `git add` is allowed. The user commits. Each task ends with `git add` + stop for review.
- **At the end of each task:** mark it complete in this file, then stop and let the user review.
- TDD: write the failing test first, watch it fail, then implement.
- DDD layering: `domain/` depends on nothing; `application/` orchestrates; `infrastructure/` holds Prisma and I/O; `web/` holds UI. Repository interfaces live in `domain/`, implementations in `infrastructure/`.
- No raw SQL in `web/actions/` — Prisma query builder or repository methods only.
- Every server action starts with `const rateLimited = await checkRateLimit(); if (rateLimited) return rateLimited;`
- All user-facing strings are localized in `messages/en.json` and `messages/ru.json`. Domain and use cases return **codes**, never messages.
- Messages with limits/counts must be **parameterized** (`{maxMb}`, `{limit}`), never hardcoded numbers.
- Server → Client: serialize domain objects to plain objects, filter sensitive fields server-side, convert Prisma `Decimal` with `Number()`. **Never send attachment `bytes` to a Client Component.**
- Entities are never deleted, only archived — except link rows, vote drafts, and notifications. Attachments belong to a poll and follow the poll's lifecycle via `onDelete: Cascade` at the DB level only; the application never deletes polls.
- All clickable native `<button>` / `<a>` need `cursor-pointer`, plus `disabled:cursor-not-allowed` where applicable.
- Run `yarn prisma:generate` after `prisma migrate dev` — migrate does not regenerate the client in this repo.
- Test command: `yarn vitest run <path>`.
- Typecheck command: **`yarn typecheck`** (which is `tsc --noEmit -p tsconfig.build.json`). Do **not** use bare `tsc --noEmit` — it type-checks test files too and reports ~653 pre-existing errors, so it cannot tell you whether your change broke anything. `yarn typecheck` is clean and is the real gate.

## File Structure

**New — domain**

- `src/domain/shared/attachments/extractAttachmentIds.ts` — prefix-parameterized id extractor (lifted from report)
- `src/domain/shared/attachments/validateAttachmentRefs.ts` — prefix-parameterized ref guard (lifted from `Report.ts`)
- `src/domain/poll/PollAttachment.ts` — entity, whitelist, size caps, magic-byte validation
- `src/domain/poll/PollAttachmentRepository.ts` — repository interface

**New — application**

- `src/application/poll/ResolvePollAttachmentVisibilityService.ts` — who may read a poll's attachments
- `src/application/poll/AddPollAttachmentUseCase.ts`
- `src/application/poll/RemovePollAttachmentUseCase.ts`

**New — infrastructure**

- `src/infrastructure/repositories/PrismaPollAttachmentRepository.ts`

**New — web**

- `src/app/api/poll-attachments/route.ts` — upload
- `src/app/api/poll-attachments/[id]/route.ts` — auth-checked serve
- `src/web/components/markdown/MarkdownRenderer.tsx` — generalized from report
- `src/web/components/markdown/MarkdownEditor.tsx` — generalized from report
- `src/web/components/markdown/isAllowedAttachmentSrc.ts` — generalized
- `src/web/lib/stripMarkdown.ts` — markdown → plain text for cards and PDF export
- `src/web/components/polls/SaveDraftBeforeAttachModal.tsx`

**Modified**

- `prisma/schema.prisma` — `PollAttachment` model, `Poll.attachments` relation
- `src/domain/poll/Poll.ts` — `attachmentIds`, ref validation, add/remove attachment
- `src/domain/poll/PollDomainCodes.ts` — new codes
- `src/domain/report/Report.ts` — use the shared helpers
- `src/domain/report/extractReportAttachmentIdsFromBody.ts` — deleted, replaced by shared helper
- `src/infrastructure/repositories/PrismaPollRepository.ts` — load `attachmentIds`
- `src/infrastructure/index.ts` — export the new repository
- `src/web/components/report/*` — re-point at the shared markdown components
- `src/app/[locale]/polls/create/CreatePollForm.tsx`, `.../[pollId]/edit/EditPollForm.tsx`
- `src/app/[locale]/polls/[pollId]/vote/page.tsx`, `.../results/page.tsx`
- `src/web/components/polls/PollCard.tsx`, `src/web/components/polls/PublicOpenPollPreview.tsx`
- `src/app/api/polls/[pollId]/results/pdf/route.ts`, `.../named-pdf/route.ts`
- `messages/en.json`, `messages/ru.json`

**Already done (no task needed)**

- `POLL_DESCRIPTION_MAX_LENGTH` is already `10000` in `src/domain/poll/Poll.ts:13`. No migration needed — `polls.description` is Postgres `TEXT`.

---

### Task 1: Lift attachment-ref helpers into the shared domain — ✅ COMPLETE

Behavior-preserving refactor. Reports must work exactly as before; polls will reuse these next.

**Files:**

- Create: `src/domain/shared/attachments/extractAttachmentIds.ts`
- Create: `src/domain/shared/attachments/validateAttachmentRefs.ts`
- Create: `src/domain/shared/attachments/__tests__/extractAttachmentIds.test.ts`
- Create: `src/domain/shared/attachments/__tests__/validateAttachmentRefs.test.ts`
- Modify: `src/domain/report/Report.ts` (imports; delete the private `validateBodyAttachmentRefs` at lines 408-427)
- Delete: `src/domain/report/extractReportAttachmentIdsFromBody.ts` and its test

**Interfaces:**

- Produces:
  - `extractAttachmentIds(text: string, apiPrefix: string): string[]`
  - `validateAttachmentRefs(text: string, apiPrefix: string, ownIds: string[], errorCode: string): Result<void, string>`
- Consumes: `Result`, `success`, `failure` from `src/domain/shared/Result`

- [ ] **Step 1: Write the failing tests**

`src/domain/shared/attachments/__tests__/extractAttachmentIds.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractAttachmentIds } from '../extractAttachmentIds';

const REPORTS = '/api/report-attachments';
const POLLS = '/api/poll-attachments';

describe('extractAttachmentIds', () => {
  it('returns an empty array when there are no refs', () => {
    expect(extractAttachmentIds('just text', POLLS)).toEqual([]);
  });

  it('extracts an id from markdown image syntax', () => {
    const text = '![photo](/api/poll-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['abc123']);
  });

  it('extracts an id from markdown link syntax', () => {
    const text = '[survey.pdf](/api/poll-attachments/def456)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['def456']);
  });

  it('deduplicates repeated ids', () => {
    const text =
      '![a](/api/poll-attachments/abc123) ![b](/api/poll-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['abc123']);
  });

  it('ignores refs belonging to a different prefix', () => {
    const text = '![a](/api/report-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual([]);
  });

  it('still extracts report refs when given the report prefix', () => {
    const text = '![a](/api/report-attachments/abc123)';
    expect(extractAttachmentIds(text, REPORTS)).toEqual(['abc123']);
  });
});
```

`src/domain/shared/attachments/__tests__/validateAttachmentRefs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateAttachmentRefs } from '../validateAttachmentRefs';

const POLLS = '/api/poll-attachments';
const CODE = 'domain.poll.descriptionInvalidAttachmentRef';

describe('validateAttachmentRefs', () => {
  it('succeeds when there are no refs', () => {
    const r = validateAttachmentRefs('plain text', POLLS, [], CODE);
    expect(r.success).toBe(true);
  });

  it('succeeds when every ref belongs to the owner', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(text, POLLS, ['abc123'], CODE);
    expect(r.success).toBe(true);
  });

  it('fails when a ref does not belong to the owner', () => {
    const text = '![a](/api/poll-attachments/foreign999)';
    const r = validateAttachmentRefs(text, POLLS, ['abc123'], CODE);
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(CODE);
  });

  it('fails when the owner has no attachments at all', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(text, POLLS, [], CODE);
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run src/domain/shared/attachments`
Expected: FAIL — cannot resolve `../extractAttachmentIds` and `../validateAttachmentRefs`.

- [ ] **Step 3: Implement the extractor**

`src/domain/shared/attachments/extractAttachmentIds.ts`:

```typescript
// Inline attachment URLs look like:
//   ![alt](/api/<kind>-attachments/<id>)   — images
//   [name](/api/<kind>-attachments/<id>)   — PDFs and other downloads
// Both share the same path prefix. Ids are cuid/cuid2-style: lowercase
// letters + digits. We also accept hex/uppercase/underscore/hyphen to keep
// the extractor tolerant if the id scheme ever changes.

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractAttachmentIds(
  text: string,
  apiPrefix: string
): string[] {
  const pattern = new RegExp(
    `${escapeForRegex(apiPrefix)}/([A-Za-z0-9_-]+)`,
    'g'
  );
  const seen = new Set<string>();

  for (const m of text.matchAll(pattern)) {
    seen.add(m[1]);
  }

  return [...seen];
}
```

- [ ] **Step 4: Implement the validator**

`src/domain/shared/attachments/validateAttachmentRefs.ts`:

```typescript
import { Result, success, failure } from '../Result';
import { extractAttachmentIds } from './extractAttachmentIds';

// Text may only reference attachments belonging to its own aggregate. This
// prevents leaks where pasting a URL from another (private) report or poll
// would render fine for the author but 404 for everyone else.
export function validateAttachmentRefs(
  text: string,
  apiPrefix: string,
  ownIds: string[],
  errorCode: string
): Result<void, string> {
  const refIds = extractAttachmentIds(text, apiPrefix);

  if (refIds.length === 0) {
    return success(undefined);
  }

  const ownSet = new Set(ownIds);

  for (const id of refIds) {
    if (!ownSet.has(id)) {
      return failure(errorCode);
    }
  }

  return success(undefined);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn vitest run src/domain/shared/attachments`
Expected: PASS — 10 tests.

- [ ] **Step 6: Re-point `Report.ts` at the shared helpers**

In `src/domain/report/Report.ts`, replace the import on line 6:

```typescript
import { validateAttachmentRefs } from '../shared/attachments/validateAttachmentRefs';

export const REPORT_ATTACHMENT_API_PREFIX = '/api/report-attachments';
```

Delete the private `validateBodyAttachmentRefs` function (lines 408-427) and update both call sites. Line 65 becomes:

```typescript
const refCheck = validateAttachmentRefs(
  input.body,
  REPORT_ATTACHMENT_API_PREFIX,
  [],
  ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF
);
```

Line 203 becomes:

```typescript
const refCheck = validateAttachmentRefs(
  newBody,
  REPORT_ATTACHMENT_API_PREFIX,
  this.props.attachmentIds,
  ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF
);
```

Then delete `src/domain/report/extractReportAttachmentIdsFromBody.ts` and `src/domain/report/__tests__/extractReportAttachmentIdsFromBody.test.ts`.

- [ ] **Step 7: Verify reports still behave identically**

Run: `yarn vitest run src/domain/report src/application/report`
Expected: PASS — no behavior change. If any report test fails, the refactor is wrong; fix it rather than changing the test.

- [ ] **Step 8: Stage and stop for review**

```bash
git add src/domain/shared/attachments src/domain/report
```

Mark Task 1 complete in this file, then stop and let the user review.

---

### Task 2: `PollAttachment` domain entity — ✅ COMPLETE

**Files:**

- Create: `src/domain/poll/PollAttachment.ts`
- Create: `src/domain/poll/__tests__/PollAttachment.test.ts`
- Modify: `src/domain/poll/PollDomainCodes.ts`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Produces:
  - `POLL_ATTACHMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024`
  - `POLL_ATTACHMENT_PDF_MAX_BYTES = 10 * 1024 * 1024`
  - `POLL_ATTACHMENT_COUNT_LIMIT = 20`
  - `POLL_ATTACHMENT_API_PREFIX = '/api/poll-attachments'`
  - `POLL_ATTACHMENT_ALLOWED_MIME_TYPES` (readonly tuple)
  - `class PollAttachment` with `create(input)`, `createWithBytes(input)`, `reconstitute(input)`
- Consumes: `Result` from `src/domain/shared/Result`, `PollDomainCodes`

- [ ] **Step 1: Write the failing test**

`src/domain/poll/__tests__/PollAttachment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  PollAttachment,
  POLL_ATTACHMENT_IMAGE_MAX_BYTES,
} from '../PollAttachment';
import { PollDomainCodes } from '../PollDomainCodes';

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEAD = Buffer.from('%PDF-1.7', 'ascii');
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('PollAttachment.create', () => {
  it('rejects an empty file name', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: '   ',
      mimeType: 'image/png',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY
    );
  });

  it('rejects a MIME type outside the whitelist', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'clip.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects Word documents, which reports allow but polls do not', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'doc.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects an image over the image cap', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'big.png',
      mimeType: 'image/png',
      sizeBytes: POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });

  it('accepts a valid image and trims the file name', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: '  photo.png  ',
      mimeType: 'image/png',
      sizeBytes: 1000,
    });
    expect(r.success).toBe(true);
    expect(r.success === true && r.value.fileName).toBe('photo.png');
  });
});

describe('PollAttachment.createWithBytes', () => {
  it('accepts a PNG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a JPEG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: JPEG_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a PDF whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'survey.pdf',
      mimeType: 'application/pdf',
      bytes: PDF_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an executable renamed and declared as a PDF', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'evil.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH
    );
  });

  it('reports the size error before the magic error for an oversized file', () => {
    const oversized = Buffer.alloc(POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1);
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'big.png',
      mimeType: 'image/png',
      bytes: oversized,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/domain/poll/__tests__/PollAttachment.test.ts`
Expected: FAIL — cannot resolve `../PollAttachment`.

- [ ] **Step 3: Add the domain codes**

In `src/domain/poll/PollDomainCodes.ts`, add before the closing brace:

```typescript
  // Poll description attachments
  POLL_ATTACHMENT_FILENAME_EMPTY: 'domain.poll.attachmentFileNameEmpty',
  POLL_ATTACHMENT_TYPE_NOT_ALLOWED: 'domain.poll.attachmentTypeNotAllowed',
  POLL_ATTACHMENT_TOO_LARGE: 'domain.poll.attachmentTooLarge',
  POLL_ATTACHMENT_MAGIC_MISMATCH: 'domain.poll.attachmentMagicMismatch',
  POLL_ATTACHMENT_LIMIT_REACHED: 'domain.poll.attachmentLimitReached',
  POLL_ATTACHMENT_NOT_FOUND: 'domain.poll.attachmentNotFound',
  POLL_DESCRIPTION_INVALID_ATTACHMENT_REF:
    'domain.poll.descriptionInvalidAttachmentRef',
  POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE:
    'domain.poll.cannotChangeAttachmentsActive',
```

- [ ] **Step 4: Add the localized messages**

In `messages/en.json`, under the existing `domain.poll` object:

```json
"attachmentFileNameEmpty": "File name cannot be empty",
"attachmentTypeNotAllowed": "Only PNG, JPEG, WebP images and PDF files can be attached",
"attachmentTooLarge": "File is too large. Images may be up to {maxImageMb} MB, PDFs up to {maxPdfMb} MB",
"attachmentMagicMismatch": "File contents do not match its type",
"attachmentLimitReached": "A poll may have at most {limit} attachments",
"attachmentNotFound": "Attachment not found",
"descriptionInvalidAttachmentRef": "The description references a file that does not belong to this poll",
"cannotChangeAttachmentsActive": "Attachments cannot be changed once voting has started",
```

In `messages/ru.json`, same keys:

```json
"attachmentFileNameEmpty": "Имя файла не может быть пустым",
"attachmentTypeNotAllowed": "Прикреплять можно только изображения PNG, JPEG, WebP и файлы PDF",
"attachmentTooLarge": "Файл слишком большой. Изображения — до {maxImageMb} МБ, PDF — до {maxPdfMb} МБ",
"attachmentMagicMismatch": "Содержимое файла не соответствует его типу",
"attachmentLimitReached": "К голосованию можно прикрепить не более {limit} файлов",
"attachmentNotFound": "Файл не найден",
"descriptionInvalidAttachmentRef": "Описание ссылается на файл, не принадлежащий этому голосованию",
"cannotChangeAttachmentsActive": "Нельзя изменять вложения после начала голосования",
```

- [ ] **Step 5: Register the message parameters**

In `src/web/actions/utils/errorCodeParams.ts`, add to the map alongside the existing `'domain.poll.descriptionTooLong'` entry:

```typescript
'domain.poll.attachmentTooLarge': {
  maxImageMb: POLL_ATTACHMENT_IMAGE_MAX_BYTES / (1024 * 1024),
  maxPdfMb: POLL_ATTACHMENT_PDF_MAX_BYTES / (1024 * 1024),
},
'domain.poll.attachmentLimitReached': { limit: POLL_ATTACHMENT_COUNT_LIMIT },
```

Import the three constants from `@/domain/poll/PollAttachment` at the top of that file.

- [ ] **Step 6: Implement the entity**

`src/domain/poll/PollAttachment.ts`:

```typescript
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `yarn vitest run src/domain/poll/__tests__/PollAttachment.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 8: Stage and stop for review**

```bash
git add src/domain/poll messages src/web/actions/utils/errorCodeParams.ts
```

Mark Task 2 complete in this file, then stop and let the user review.

---

### Task 3: Prisma model, migration, and repository — ✅ COMPLETE

Migration created: `prisma/migrations/20260808161216_add_poll_attachments/`

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/domain/poll/PollAttachmentRepository.ts`
- Create: `src/infrastructure/repositories/PrismaPollAttachmentRepository.ts`
- Modify: `src/infrastructure/index.ts`

**Interfaces:**

- Consumes: `PollAttachment` from Task 2
- Produces:
  - `interface PollAttachmentMetadata { id, pollId, fileName, mimeType, sizeBytes, createdAt }`
  - `interface PollAttachmentBytes { fileName, mimeType, bytes }`
  - `interface PollAttachmentRepository` with `save`, `findByPollId`, `findBytesById`, `findById`, `countByPollId`, `deleteById`
  - `class PrismaPollAttachmentRepository`

- [ ] **Step 1: Add the Prisma model**

In `prisma/schema.prisma`, add after the `Poll` model:

```prisma
model PollAttachment {
  id        String   @id @default(cuid())
  pollId    String   @map("poll_id")
  fileName  String   @map("file_name")
  mimeType  String   @map("mime_type")
  sizeBytes Int      @map("size_bytes")
  // bytea — kept inline for atomicity with the poll row and so the file is
  // covered by the same backup as the poll it evidences. Capped at 10 MB by
  // domain validation; Postgres TOAST stores values >2 KB out of line, so
  // this does not slow row scans on Poll.
  bytes     Bytes
  createdAt DateTime @default(now()) @map("created_at")

  poll Poll @relation(fields: [pollId], references: [id], onDelete: Cascade)

  @@index([pollId])
  @@map("poll_attachments")
}
```

In the `Poll` model, add to the relations block:

```prisma
  attachments PollAttachment[]
```

- [ ] **Step 2: Create and apply the migration**

```bash
yarn prisma migrate dev --name add_poll_attachments
yarn prisma:generate
```

Expected: a new `poll_attachments` table. `prisma migrate dev` does **not** regenerate the client in this repo, so the second command is required.

- [ ] **Step 3: Write the repository interface**

`src/domain/poll/PollAttachmentRepository.ts`:

```typescript
import { PollAttachment } from './PollAttachment';
import { Result } from '../shared/Result';

export interface PollAttachmentMetadata {
  id: string;
  pollId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PollAttachmentBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface PollAttachmentRepository {
  save(
    attachment: PollAttachment,
    bytes: Buffer
  ): Promise<Result<PollAttachmentMetadata, string>>;
  findByPollId(
    pollId: string
  ): Promise<Result<PollAttachmentMetadata[], string>>;
  findBytesById(
    id: string
  ): Promise<Result<PollAttachmentBytes | null, string>>;
  findById(id: string): Promise<Result<PollAttachmentMetadata | null, string>>;
  countByPollId(pollId: string): Promise<Result<number, string>>;
  deleteById(id: string): Promise<Result<void, string>>;
}
```

- [ ] **Step 4: Implement the Prisma repository**

`src/infrastructure/repositories/PrismaPollAttachmentRepository.ts`:

```typescript
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollAttachment } from '../../domain/poll/PollAttachment';
import {
  PollAttachmentRepository,
  PollAttachmentMetadata,
  PollAttachmentBytes,
} from '../../domain/poll/PollAttachmentRepository';

// Metadata-only projection — never select `bytes` here. The download route is
// the only path that should materialize file content.
const METADATA_SELECT = {
  id: true,
  pollId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export class PrismaPollAttachmentRepository implements PollAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    attachment: PollAttachment,
    bytes: Buffer
  ): Promise<Result<PollAttachmentMetadata, string>> {
    try {
      const created = await this.prisma.pollAttachment.create({
        data: {
          pollId: attachment.pollId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          // Prisma 7 strictly types Bytes as Uint8Array<ArrayBuffer>; Node
          // Buffers may sit on a SharedArrayBuffer (ArrayBufferLike) and get
          // rejected. Copy into a fresh Uint8Array backed by a plain
          // ArrayBuffer so the strict type matches.
          bytes: (() => {
            const ab = new ArrayBuffer(bytes.byteLength);
            new Uint8Array(ab).set(bytes);

            return new Uint8Array(ab);
          })(),
        },
        select: METADATA_SELECT,
      });

      return success(created);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByPollId(
    pollId: string
  ): Promise<Result<PollAttachmentMetadata[], string>> {
    try {
      const rows = await this.prisma.pollAttachment.findMany({
        where: { pollId },
        select: METADATA_SELECT,
        orderBy: { createdAt: 'asc' },
      });

      return success(rows);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(
    id: string
  ): Promise<Result<PollAttachmentMetadata | null, string>> {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: METADATA_SELECT,
      });

      return success(row);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findBytesById(
    id: string
  ): Promise<Result<PollAttachmentBytes | null, string>> {
    try {
      const row = await this.prisma.pollAttachment.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, bytes: true },
      });

      if (!row) {
        return success(null);
      }

      return success({
        fileName: row.fileName,
        mimeType: row.mimeType,
        bytes: Buffer.from(row.bytes),
      });
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countByPollId(pollId: string): Promise<Result<number, string>> {
    try {
      const count = await this.prisma.pollAttachment.count({
        where: { pollId },
      });

      return success(count);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async deleteById(id: string): Promise<Result<void, string>> {
    try {
      await this.prisma.pollAttachment.delete({ where: { id } });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
```

- [ ] **Step 5: Export from the infrastructure barrel**

In `src/infrastructure/index.ts`, add alongside the other repository exports:

```typescript
export { PrismaPollAttachmentRepository } from './repositories/PrismaPollAttachmentRepository';
```

- [ ] **Step 6: Verify it compiles and nothing regressed**

Run: `yarn typecheck && yarn vitest run`
Expected: no type errors, all existing tests pass.

- [ ] **Step 7: Stage and stop for review**

```bash
git add prisma src/domain/poll src/infrastructure
```

Mark Task 3 complete in this file, then stop and let the user review.

---

### Task 4: `Poll` aggregate gains attachments — ✅ COMPLETE

**Files:**

- Modify: `src/domain/poll/Poll.ts`
- Modify: `src/domain/poll/__tests__/Poll.test.ts`

**Interfaces:**

- Consumes: `validateAttachmentRefs` (Task 1), `POLL_ATTACHMENT_API_PREFIX` and `POLL_ATTACHMENT_COUNT_LIMIT` (Task 2)
- Produces on `Poll`:
  - `get attachmentIds(): string[]`
  - `addAttachment(attachmentId: string): Result<void, string>`
  - `removeAttachment(attachmentId: string): Result<void, string>`
  - `PollProps.attachmentIds: string[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/poll/__tests__/Poll.test.ts`. Use the file's existing helper for building a poll if one exists; otherwise build via `Poll.create(...)` matching the signature at `Poll.ts:38-48`.

```typescript
describe('Poll attachments', () => {
  const validDates = {
    start: new Date('2030-01-01'),
    end: new Date('2030-02-01'),
  };

  function draftPoll() {
    const r = Poll.create(
      'Fence dispute',
      'The fence was moved.',
      'org1',
      null,
      'user1',
      validDates.start,
      validDates.end
    );

    if (!r.success) {
      throw new Error('fixture poll failed to build: ' + r.error);
    }

    return r.value;
  }

  it('starts with no attachments', () => {
    expect(draftPoll().attachmentIds).toEqual([]);
  });

  it('adds an attachment id', () => {
    const poll = draftPoll();
    const r = poll.addAttachment('att1');
    expect(r.success).toBe(true);
    expect(poll.attachmentIds).toEqual(['att1']);
  });

  it('rejects adding past the count limit', () => {
    const poll = draftPoll();

    for (let i = 0; i < POLL_ATTACHMENT_COUNT_LIMIT; i++) {
      expect(poll.addAttachment(`att${i}`).success).toBe(true);
    }

    const r = poll.addAttachment('one-too-many');
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
    );
  });

  it('removes an attachment id', () => {
    const poll = draftPoll();
    poll.addAttachment('att1');
    const r = poll.removeAttachment('att1');
    expect(r.success).toBe(true);
    expect(poll.attachmentIds).toEqual([]);
  });

  it('fails to remove an attachment that is not attached', () => {
    const poll = draftPoll();
    const r = poll.removeAttachment('nope');
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND
    );
  });

  it('does not leak internal state through the getter', () => {
    const poll = draftPoll();
    poll.addAttachment('att1');
    poll.attachmentIds.push('injected');
    expect(poll.attachmentIds).toEqual(['att1']);
  });
});

describe('Poll.updateDescription attachment refs', () => {
  function draftPollWithAttachment() {
    const r = Poll.create(
      'Fence dispute',
      'Initial text.',
      'org1',
      null,
      'user1',
      new Date('2030-01-01'),
      new Date('2030-02-01')
    );

    if (!r.success) {
      throw new Error('fixture poll failed to build: ' + r.error);
    }

    r.value.addAttachment('own1');

    return r.value;
  }

  it('accepts a description referencing its own attachment', () => {
    const poll = draftPollWithAttachment();
    const r = poll.updateDescription(
      'See ![photo](/api/poll-attachments/own1)'
    );
    expect(r.success).toBe(true);
  });

  it('rejects a description referencing a foreign attachment', () => {
    const poll = draftPollWithAttachment();
    const r = poll.updateDescription(
      'See ![photo](/api/poll-attachments/foreign9)'
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
    );
  });

  it('accepts a PDF link ref to its own attachment', () => {
    const poll = draftPollWithAttachment();
    const r = poll.updateDescription(
      'See [survey.pdf](/api/poll-attachments/own1)'
    );
    expect(r.success).toBe(true);
  });

  it('ignores a report-attachment URL, which is not a poll ref', () => {
    const poll = draftPollWithAttachment();
    const r = poll.updateDescription(
      'See ![x](/api/report-attachments/other1)'
    );
    expect(r.success).toBe(true);
  });
});
```

Add the needed imports at the top of the test file:

```typescript
import { POLL_ATTACHMENT_COUNT_LIMIT } from '../PollAttachment';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run src/domain/poll/__tests__/Poll.test.ts`
Expected: FAIL — `poll.attachmentIds` is undefined, `addAttachment` is not a function.

- [ ] **Step 3: Add the prop, getter, and mutators**

In `src/domain/poll/Poll.ts`:

Add to `PollProps` (after `questions: Question[];`):

```typescript
  attachmentIds: string[];
```

Add the imports:

```typescript
import { validateAttachmentRefs } from '../shared/attachments/validateAttachmentRefs';
import {
  POLL_ATTACHMENT_API_PREFIX,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from './PollAttachment';
```

In `Poll.create`, initialize `attachmentIds: []` in the props object it builds. In `Poll.reconstitute`, accept and pass through `attachmentIds` (defaulting to `[]` when the caller omits it, so existing callers keep working).

Add the getter and mutators near the other public methods:

```typescript
  public get attachmentIds(): string[] {
    return [...this.props.attachmentIds];
  }

  // Attachments are part of the description's evidence, so they follow the
  // same freeze rule: mutable while DRAFT or READY, fixed once voting opens.
  // Otherwise voters would see different evidence at different times.
  public addAttachment(attachmentId: string): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    if (this.props.attachmentIds.length >= POLL_ATTACHMENT_COUNT_LIMIT) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    }

    this.props.attachmentIds.push(attachmentId);

    return success(undefined);
  }

  public removeAttachment(attachmentId: string): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    if (!this.props.attachmentIds.includes(attachmentId)) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
    }

    this.props.attachmentIds = this.props.attachmentIds.filter(
      (id) => id !== attachmentId
    );

    return success(undefined);
  }
```

- [ ] **Step 4: Add the ref check to `updateDescription`**

In `updateDescription` (`Poll.ts:280`), insert after the length check and before the profanity check:

```typescript
const refCheck = validateAttachmentRefs(
  newDescription,
  POLL_ATTACHMENT_API_PREFIX,
  this.props.attachmentIds,
  PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
);

if (!refCheck.success) {
  return refCheck;
}
```

**Deviation from the original plan (applied during execution):** the plan first said to skip the ref check in `Poll.create`. That was wrong — `Report.create` (`Report.ts:69`) _does_ validate with `[]`, and without it a caller could create a poll whose description already references another poll's file. The renderer's allowlist would block it from rendering, so it was not a leak, but it let invalid data into the database. `Poll.create` now runs the same check with `[]`, matching `Report.create`. The normal create flow is unaffected: refs are only inserted after an upload succeeds, which happens after the DRAFT is saved.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn vitest run src/domain/poll`
Expected: PASS — including all pre-existing poll tests.

- [ ] **Step 6: Stage and stop for review**

```bash
git add src/domain/poll
```

Mark Task 4 complete in this file, then stop and let the user review.

---

### Task 5: `PrismaPollRepository` loads and persists `attachmentIds` — ✅ COMPLETE

**Turned out simpler than this task was written.** The repository funnels every read
through a single `toDomainPoll` mapper (`PrismaPollRepository.ts:397`), so there
was one mapping change, not several. The `include` block is repeated 6 times
though, and two test files pin its exact shape via `toHaveBeenCalledWith`
(`PrismaPollRepository.test.ts` ×5, `PrismaPollRepository.searchPolls.test.ts` ×1)
— those assertions needed updating too.

**Files:**

- Modify: `src/infrastructure/repositories/PrismaPollRepository.ts`

**Interfaces:**

- Consumes: `Poll.attachmentIds` (Task 4), the `poll_attachments` table (Task 3)
- Produces: polls reconstituted with their attachment ids populated

- [ ] **Step 1: Locate the reconstitution sites**

Run: `grep -n "Poll.reconstitute" src/infrastructure/repositories/PrismaPollRepository.ts`

Every call site must now supply `attachmentIds`. Mirror how `PrismaReportRepository` does it (see `PrismaReportRepository.ts:58` and `:253-271`).

- [ ] **Step 2: Include attachments in the queries**

For each Prisma query that loads a poll for reconstitution, add to the `select`/`include`:

```typescript
attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
```

and map it when reconstituting:

```typescript
attachmentIds: row.attachments.map((a) => a.id),
```

Attachment rows are written by `PrismaPollAttachmentRepository.save`, so the poll repository only reads them — there is no write-back path for `attachmentIds`.

- [ ] **Step 3: Verify nothing regressed**

Run: `yarn typecheck && yarn vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 4: Stage and stop for review**

```bash
git add src/infrastructure
```

Mark Task 5 complete in this file, then stop and let the user review.

---

### Task 6: `ResolvePollAttachmentVisibilityService` — ✅ COMPLETE

**Two rules added beyond what this task specified**, after checking how the rest
of the app gates poll access (`GetPollResultsUseCase.ts:108-114` uses
`isUserMember` / `isUserAdmin` / `isSuperAdmin`, confirming the shape):

1. **Draft polls** expose nothing beyond the overrides — a draft is
   mid-composition, so its evidence should not be readable org-wide.
2. **Archived polls** likewise.

Both mirror `ResolveReportVisibilityService`, which already does exactly this
for reports. Without them, any org member could read the evidence attached to a
poll that had never been published or had been withdrawn.

Implementation uses the domain's own `poll.isOpen()` / `isDraft()` /
`isArchived()` predicates rather than comparing `pollType` strings.

The one genuinely new concept — polls have no visibility abstraction today. Read access must mirror how the poll itself is read.

**Files:**

- Create: `src/application/poll/ResolvePollAttachmentVisibilityService.ts`
- Create: `src/application/poll/__tests__/ResolvePollAttachmentVisibilityService.test.ts`

**Interfaces:**

- Produces:
  - `interface OrgRepoForPollVisibility { isUserMember(userId: string, organizationId: string): Promise<boolean>; isUserAdmin(userId: string, organizationId: string): Promise<boolean>; }`
  - `interface BoardRepoForPollVisibility { isUserMember(userId: string, boardId: string): Promise<boolean>; }`
  - `interface UserRepoForPollVisibility { isSuperAdmin(userId: string): Promise<boolean>; }`
  - `class ResolvePollAttachmentVisibilityService` with `canRead(poll: Poll, viewerId: string | null): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

`src/application/poll/__tests__/ResolvePollAttachmentVisibilityService.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ResolvePollAttachmentVisibilityService } from '../ResolvePollAttachmentVisibilityService';
import { Poll } from '../../../domain/poll/Poll';
import { PollType } from '../../../domain/poll/PollType';

function buildPoll(overrides: { pollType?: string; boardId?: string | null }) {
  const r = Poll.create(
    'Title',
    'Description',
    'org1',
    overrides.boardId ?? null,
    'creator1',
    new Date('2030-01-01'),
    new Date('2030-02-01'),
    undefined,
    overrides.pollType ?? PollType.ORGANIZATION
  );

  if (!r.success) {
    throw new Error('fixture poll failed to build: ' + r.error);
  }

  return r.value;
}

function buildDeps(over: {
  isMember?: boolean;
  isAdmin?: boolean;
  isSuper?: boolean;
  isBoardMember?: boolean;
}) {
  return {
    orgs: {
      isUserMember: vi.fn().mockResolvedValue(over.isMember ?? false),
      isUserAdmin: vi.fn().mockResolvedValue(over.isAdmin ?? false),
    },
    boards: {
      isUserMember: vi.fn().mockResolvedValue(over.isBoardMember ?? false),
    },
    users: {
      isSuperAdmin: vi.fn().mockResolvedValue(over.isSuper ?? false),
    },
  };
}

describe('ResolvePollAttachmentVisibilityService', () => {
  it('allows anonymous read of an OPEN poll', async () => {
    const d = buildDeps({});
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({ pollType: PollType.OPEN });

    expect(await svc.canRead(poll, null)).toBe(true);
  });

  it('denies anonymous read of an ORGANIZATION poll', async () => {
    const d = buildDeps({});
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({});

    expect(await svc.canRead(poll, null)).toBe(false);
  });

  it('allows the poll creator to read', async () => {
    const d = buildDeps({});
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({});

    expect(await svc.canRead(poll, 'creator1')).toBe(true);
  });

  it('allows a superadmin to read', async () => {
    const d = buildDeps({ isSuper: true });
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({});

    expect(await svc.canRead(poll, 'someone')).toBe(true);
  });

  it('allows an org member to read an org-wide poll', async () => {
    const d = buildDeps({ isMember: true });
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({});

    expect(await svc.canRead(poll, 'member1')).toBe(true);
  });

  it('denies a non-member read of an org poll', async () => {
    const d = buildDeps({ isMember: false });
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({});

    expect(await svc.canRead(poll, 'stranger')).toBe(false);
  });

  it('denies an org member who is not on the board for a board-scoped poll', async () => {
    const d = buildDeps({ isMember: true, isBoardMember: false });
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({ boardId: 'board1' });

    expect(await svc.canRead(poll, 'member1')).toBe(false);
  });

  it('allows a board member to read a board-scoped poll', async () => {
    const d = buildDeps({ isMember: true, isBoardMember: true });
    const svc = new ResolvePollAttachmentVisibilityService(
      d.orgs,
      d.boards,
      d.users
    );
    const poll = buildPoll({ boardId: 'board1' });

    expect(await svc.canRead(poll, 'member1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/application/poll/__tests__/ResolvePollAttachmentVisibilityService.test.ts`
Expected: FAIL — cannot resolve the service module.

- [ ] **Step 3: Implement the service**

`src/application/poll/ResolvePollAttachmentVisibilityService.ts`:

```typescript
import { Poll } from '../../domain/poll/Poll';
import { PollType } from '../../domain/poll/PollType';

export interface OrgRepoForPollVisibility {
  isUserMember(userId: string, organizationId: string): Promise<boolean>;
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;
}

export interface BoardRepoForPollVisibility {
  isUserMember(userId: string, boardId: string): Promise<boolean>;
}

export interface UserRepoForPollVisibility {
  isSuperAdmin(userId: string): Promise<boolean>;
}

// Who may read a poll's description attachments. This mirrors who may read
// the poll itself: OPEN polls are voted on by the whole platform and their
// public preview needs no session, so their evidence is public too.
// ORGANIZATION polls are private to the org, and narrow further to the board
// when the poll is board-scoped.
export class ResolvePollAttachmentVisibilityService {
  constructor(
    private orgs: OrgRepoForPollVisibility,
    private boards: BoardRepoForPollVisibility,
    private users: UserRepoForPollVisibility
  ) {}

  async canRead(poll: Poll, viewerId: string | null): Promise<boolean> {
    // OPEN polls are readable without a session — this matches
    // GetOpenPollPreviewUseCase, which backs the public preview page.
    if (poll.pollType === PollType.OPEN) {
      return true;
    }

    if (!viewerId) {
      return false;
    }

    // Overrides: creator, superadmin, and org admin always read.
    if (poll.createdBy === viewerId) {
      return true;
    }

    if (await this.users.isSuperAdmin(viewerId)) {
      return true;
    }

    if (await this.orgs.isUserAdmin(viewerId, poll.organizationId)) {
      return true;
    }

    if (!(await this.orgs.isUserMember(viewerId, poll.organizationId))) {
      return false;
    }

    // Board-scoped polls narrow the audience to that board's members.
    if (poll.boardId) {
      return this.boards.isUserMember(viewerId, poll.boardId);
    }

    return true;
  }
}
```

If `Poll` does not already expose `pollType`, `createdBy`, `organizationId`, or `boardId` as public getters, add the missing ones in `src/domain/poll/Poll.ts` alongside the existing getters — they are plain reads of `this.props`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/application/poll/__tests__/ResolvePollAttachmentVisibilityService.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/application/poll src/domain/poll
```

Mark Task 6 complete in this file, then stop and let the user review.

---

### Task 7: Add and remove attachment use cases — ✅ COMPLETE

**Two corrections to what this task assumed:**

- The repository method is `getPollById`, not `findById` (`PollRepository.ts:21`).
- No new error codes were needed. `PollErrors.NOT_FOUND` and
  `PollErrors.NOT_AUTHORIZED` already exist, so the planned
  `POLL_NOT_FOUND` / `NOT_AUTHOR_OR_ADMIN` additions were dropped rather than
  duplicating existing codes.

**Files:**

- Create: `src/application/poll/AddPollAttachmentUseCase.ts`
- Create: `src/application/poll/RemovePollAttachmentUseCase.ts`
- Create: `src/application/poll/__tests__/AddPollAttachmentUseCase.test.ts`
- Create: `src/application/poll/__tests__/RemovePollAttachmentUseCase.test.ts`
- Modify: `src/application/poll/PollErrors.ts` (add `POLL_NOT_FOUND` / `NOT_AUTHOR_OR_ADMIN` if not already present)

**Interfaces:**

- Consumes: `PollAttachment.createWithBytes` (Task 2), `PollAttachmentRepository` (Task 3), `Poll.addAttachment` / `removeAttachment` (Task 4)
- Produces:
  - `AddPollAttachmentUseCase` with `execute(input: { pollId: string; callerId: string; fileName: string; mimeType: string; bytes: Buffer }): Promise<Result<{ id: string }, string>>`
  - `RemovePollAttachmentUseCase` with `execute(input: { attachmentId: string; callerId: string }): Promise<Result<void, string>>`

- [ ] **Step 1: Write the failing test for adding**

`src/application/poll/__tests__/AddPollAttachmentUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AddPollAttachmentUseCase } from '../AddPollAttachmentUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { POLL_ATTACHMENT_COUNT_LIMIT } from '../../../domain/poll/PollAttachment';
import { success } from '../../../domain/shared/Result';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function draftPoll() {
  const r = Poll.create(
    'Title',
    'Description',
    'org1',
    null,
    'creator1',
    new Date('2030-01-01'),
    new Date('2030-02-01')
  );

  if (!r.success) {
    throw new Error('fixture poll failed to build: ' + r.error);
  }

  return r.value;
}

function buildDeps(over: {
  poll?: Poll | null;
  count?: number;
  isAdmin?: boolean;
  isSuper?: boolean;
}) {
  const poll = over.poll === undefined ? draftPoll() : over.poll;

  return {
    poll,
    polls: {
      findById: vi.fn().mockResolvedValue(success(poll)),
      save: vi.fn().mockResolvedValue(success(undefined)),
    },
    orgs: { isUserAdmin: vi.fn().mockResolvedValue(over.isAdmin ?? false) },
    users: { isSuperAdmin: vi.fn().mockResolvedValue(over.isSuper ?? false) },
    attachments: {
      countByPollId: vi.fn().mockResolvedValue(success(over.count ?? 0)),
      save: vi.fn().mockResolvedValue(success({ id: 'att-new' })),
    },
  };
}

describe('AddPollAttachmentUseCase', () => {
  it('rejects a caller who is neither creator, admin, nor superadmin', async () => {
    const d = buildDeps({});
    const uc = new AddPollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      pollId: 'p1',
      callerId: 'stranger',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: PNG,
    });

    expect(r.success).toBe(false);
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('rejects once the count limit is reached', async () => {
    const d = buildDeps({ count: POLL_ATTACHMENT_COUNT_LIMIT });
    const uc = new AddPollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      pollId: 'p1',
      callerId: 'creator1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: PNG,
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
    );
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('rejects a file whose magic bytes do not match', async () => {
    const d = buildDeps({});
    const uc = new AddPollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      pollId: 'p1',
      callerId: 'creator1',
      fileName: 'evil.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from([0x4d, 0x5a]),
    });

    expect(r.success).toBe(false);
    expect(d.attachments.save).not.toHaveBeenCalled();
  });

  it('saves a valid attachment and returns its id', async () => {
    const d = buildDeps({});
    const uc = new AddPollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      pollId: 'p1',
      callerId: 'creator1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: PNG,
    });

    expect(r.success).toBe(true);
    expect(r.success === true && r.value.id).toBe('att-new');
    expect(d.attachments.save).toHaveBeenCalledOnce();
  });

  it('returns not-found for a missing poll', async () => {
    const d = buildDeps({ poll: null });
    const uc = new AddPollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      pollId: 'missing',
      callerId: 'creator1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: PNG,
    });

    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/application/poll/__tests__/AddPollAttachmentUseCase.test.ts`
Expected: FAIL — cannot resolve `../AddPollAttachmentUseCase`.

- [ ] **Step 3: Implement `AddPollAttachmentUseCase`**

`src/application/poll/AddPollAttachmentUseCase.ts`:

```typescript
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import {
  PollAttachment,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from '../../domain/poll/PollAttachment';
import { PollAttachmentRepository } from '../../domain/poll/PollAttachmentRepository';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';

export interface PollRepoForAddAttachment {
  findById(pollId: string): Promise<Result<Poll | null, string>>;
  save(poll: Poll): Promise<Result<void, string>>;
}

export interface OrgRepoForAddPollAttachment {
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;
}

export interface UserRepoForAddPollAttachment {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface AddPollAttachmentInput {
  pollId: string;
  callerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface AddPollAttachmentOutput {
  id: string;
}

export class AddPollAttachmentUseCase {
  constructor(
    private polls: PollRepoForAddAttachment,
    private orgs: OrgRepoForAddPollAttachment,
    private users: UserRepoForAddPollAttachment,
    private attachments: PollAttachmentRepository
  ) {}

  async execute(
    input: AddPollAttachmentInput
  ): Promise<Result<AddPollAttachmentOutput, string>> {
    const lookup = await this.polls.findById(input.pollId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(PollErrors.POLL_NOT_FOUND);
    }

    const poll = lookup.value;

    const isCreator = poll.createdBy === input.callerId;
    const isAdmin =
      !isCreator &&
      (await this.orgs.isUserAdmin(input.callerId, poll.organizationId));
    const isSuper =
      !isCreator && !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isCreator && !isAdmin && !isSuper) {
      return failure(PollErrors.NOT_AUTHOR_OR_ADMIN);
    }

    // Fail fast on a frozen poll before any file validation or I/O.
    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    const countResult = await this.attachments.countByPollId(input.pollId);

    if (!countResult.success) {
      return failure(countResult.error);
    }

    if (countResult.value >= POLL_ATTACHMENT_COUNT_LIMIT) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    }

    const attachmentResult = PollAttachment.createWithBytes({
      pollId: input.pollId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });

    if (!attachmentResult.success) {
      return failure(attachmentResult.error);
    }

    const saved = await this.attachments.save(
      attachmentResult.value,
      input.bytes
    );

    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ id: saved.value.id });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/application/poll/__tests__/AddPollAttachmentUseCase.test.ts`
Expected: PASS — 5 tests. Add `POLL_NOT_FOUND` and `NOT_AUTHOR_OR_ADMIN` to `src/application/poll/PollErrors.ts` (with matching entries in both message files) if they are not already defined.

- [ ] **Step 5: Write the failing test for removing**

`src/application/poll/__tests__/RemovePollAttachmentUseCase.test.ts` — mirror the add tests, covering: a caller who is neither creator, admin, nor superadmin is rejected; removing from an ACTIVE poll fails with `POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE`; a missing attachment returns `POLL_ATTACHMENT_NOT_FOUND`; a valid removal calls `deleteById` exactly once.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { RemovePollAttachmentUseCase } from '../RemovePollAttachmentUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { success } from '../../../domain/shared/Result';

function draftPoll() {
  const r = Poll.create(
    'Title',
    'Description',
    'org1',
    null,
    'creator1',
    new Date('2030-01-01'),
    new Date('2030-02-01')
  );

  if (!r.success) {
    throw new Error('fixture poll failed to build: ' + r.error);
  }

  return r.value;
}

function buildDeps(over: { metadata?: unknown }) {
  const poll = draftPoll();

  return {
    poll,
    polls: {
      findById: vi.fn().mockResolvedValue(success(poll)),
      save: vi.fn().mockResolvedValue(success(undefined)),
    },
    orgs: { isUserAdmin: vi.fn().mockResolvedValue(false) },
    users: { isSuperAdmin: vi.fn().mockResolvedValue(false) },
    attachments: {
      findById: vi
        .fn()
        .mockResolvedValue(
          success(
            over.metadata === undefined
              ? { id: 'att1', pollId: 'p1' }
              : over.metadata
          )
        ),
      deleteById: vi.fn().mockResolvedValue(success(undefined)),
    },
  };
}

describe('RemovePollAttachmentUseCase', () => {
  it('returns not-found for a missing attachment', async () => {
    const d = buildDeps({ metadata: null });
    const uc = new RemovePollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      attachmentId: 'missing',
      callerId: 'creator1',
    });

    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND
    );
  });

  it('rejects a stranger', async () => {
    const d = buildDeps({});
    const uc = new RemovePollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      attachmentId: 'att1',
      callerId: 'stranger',
    });

    expect(r.success).toBe(false);
    expect(d.attachments.deleteById).not.toHaveBeenCalled();
  });

  it('deletes a valid attachment', async () => {
    const d = buildDeps({});
    const uc = new RemovePollAttachmentUseCase(
      d.polls,
      d.orgs,
      d.users,
      d.attachments
    );

    const r = await uc.execute({
      attachmentId: 'att1',
      callerId: 'creator1',
    });

    expect(r.success).toBe(true);
    expect(d.attachments.deleteById).toHaveBeenCalledWith('att1');
  });
});
```

- [ ] **Step 6: Implement `RemovePollAttachmentUseCase`**

Same shape as the add use case: look up the attachment metadata, then its poll, apply the identical creator/admin/superadmin authorization and the same `isActive() || isFinished()` freeze guard, then `deleteById`. Attachment deletion is permitted because an attachment is not one of the entities the archive-only rule protects — it is content of a not-yet-published poll, comparable to the vote drafts the rules already allow deleting.

```typescript
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { PollAttachmentRepository } from '../../domain/poll/PollAttachmentRepository';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';

export interface PollRepoForRemoveAttachment {
  findById(pollId: string): Promise<Result<Poll | null, string>>;
  save(poll: Poll): Promise<Result<void, string>>;
}

export interface OrgRepoForRemovePollAttachment {
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;
}

export interface UserRepoForRemovePollAttachment {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface RemovePollAttachmentInput {
  attachmentId: string;
  callerId: string;
}

export class RemovePollAttachmentUseCase {
  constructor(
    private polls: PollRepoForRemoveAttachment,
    private orgs: OrgRepoForRemovePollAttachment,
    private users: UserRepoForRemovePollAttachment,
    private attachments: PollAttachmentRepository
  ) {}

  async execute(
    input: RemovePollAttachmentInput
  ): Promise<Result<void, string>> {
    const metaResult = await this.attachments.findById(input.attachmentId);

    if (!metaResult.success) {
      return failure(metaResult.error);
    }

    if (!metaResult.value) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
    }

    const lookup = await this.polls.findById(metaResult.value.pollId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(PollErrors.POLL_NOT_FOUND);
    }

    const poll = lookup.value;

    const isCreator = poll.createdBy === input.callerId;
    const isAdmin =
      !isCreator &&
      (await this.orgs.isUserAdmin(input.callerId, poll.organizationId));
    const isSuper =
      !isCreator && !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isCreator && !isAdmin && !isSuper) {
      return failure(PollErrors.NOT_AUTHOR_OR_ADMIN);
    }

    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    return this.attachments.deleteById(input.attachmentId);
  }
}
```

- [ ] **Step 7: Run both test files to verify they pass**

Run: `yarn vitest run src/application/poll`
Expected: PASS — including all pre-existing poll use-case tests.

- [ ] **Step 8: Stage and stop for review**

```bash
git add src/application/poll messages
```

Mark Task 7 complete in this file, then stop and let the user review.

---

### Task 8: Upload and download routes — ✅ COMPLETE

**Rate limiting:** added to POST (each call accepts up to 10 MB), deliberately
**not** on GET — a description with 20 images issues 20 GETs per page view, so
limiting reads would break rendering.

**Verification gotcha worth remembering:** a dev server started before
`prisma generate` holds a client that does not know `pollAttachment`, so every
attachment request 404s. That makes a naive "private URL returns 404" curl a
**false positive** — it 404s for the wrong reason. Verify the authorization
matrix in a fresh process, or restart the dev server first.

**Files:**

- Create: `src/app/api/poll-attachments/route.ts`
- Create: `src/app/api/poll-attachments/[id]/route.ts`

**Interfaces:**

- Consumes: `AddPollAttachmentUseCase` (Task 7), `ResolvePollAttachmentVisibilityService` (Task 6), `PrismaPollAttachmentRepository` (Task 3)
- Produces:
  - `POST /api/poll-attachments` — multipart `pollId` + `file` → `{ id }` or `{ error }`
  - `GET /api/poll-attachments/[id]` — the file bytes, or 404

- [ ] **Step 1: Implement the upload route**

`src/app/api/poll-attachments/route.ts`, modeled on `src/app/api/report-attachments/route.ts`:

```typescript
// Upload route for poll description attachments. Receives multipart/form-data
// with a pollId string and a file blob, converts the bytes to a Buffer, and
// delegates to AddPollAttachmentUseCase which enforces authorization, the
// DRAFT/READY-only guard, the count cap, and the magic-byte / mime / size
// validations.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPollRepository,
  PrismaPollAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AddPollAttachmentUseCase } from '@/application/poll/AddPollAttachmentUseCase';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

const pollRepo = new PrismaPollRepository(prisma);
const attachmentRepo = new PrismaPollAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const uc = new AddPollAttachmentUseCase(
  pollRepo,
  orgRepo,
  userRepo,
  attachmentRepo
);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const pollId = form.get('pollId');
  const file = form.get('file');

  if (
    typeof pollId !== 'string' ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const result = await uc.execute({
    pollId,
    callerId: user.id,
    fileName: file.name,
    mimeType: file.type,
    bytes,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: await translateErrorCode(result.error) },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: result.value.id });
}
```

- [ ] **Step 2: Implement the download route**

`src/app/api/poll-attachments/[id]/route.ts`, modeled on `src/app/api/report-attachments/[id]/route.ts`:

```typescript
// Visibility-checked download route for poll description attachments. Auth is
// optional — OPEN polls are readable without a session. Forbidden / missing
// reads collapse to 404 to avoid leaking whether an attachment id exists.
//
// Why inline not attachment? Poll evidence is meant to be read in place —
// images render in the description, PDFs open in the browser's viewer rather
// than forcing a save dialog. RFC 5987 filename encoding keeps non-ASCII
// names (Russian etc.) intact.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPollRepository,
  PrismaPollAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { ResolvePollAttachmentVisibilityService } from '@/application/poll/ResolvePollAttachmentVisibilityService';
import { PollType } from '@/domain/poll/PollType';

const attachmentRepo = new PrismaPollAttachmentRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const visibilitySvc = new ResolvePollAttachmentVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Metadata first: lightweight, no bytes yet.
  const metaR = await attachmentRepo.findById(id);

  if (!metaR.success || !metaR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const pollR = await pollRepo.findById(metaR.value.pollId);

  if (!pollR.success || !pollR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const poll = pollR.value;

  // Auth is optional: OPEN polls need no session.
  const viewer = await getCurrentUser();
  const canRead = await visibilitySvc.canRead(poll, viewer?.id ?? null);

  if (!canRead) {
    // Collapse forbidden + not-found into the same 404 to avoid existence
    // leaks.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const bytesR = await attachmentRepo.findBytesById(id);

  if (!bytesR.success || !bytesR.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { fileName, mimeType, bytes } = bytesR.value;

  // RFC 5987 encoding: encodeURIComponent percent-encodes everything except
  // unreserved chars; we also escape single-quote and parens, which are not
  // safe inside the ext-value token.
  const encoded = encodeURIComponent(fileName).replace(
    /['()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

  const isOpen = poll.pollType === PollType.OPEN;

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encoded}`,
      'Cache-Control': isOpen ? 'public, max-age=300' : 'private, no-store',
    },
  });
}
```

- [ ] **Step 3: Verify it compiles**

Run: `yarn typecheck`
Expected: no type errors. If `PrismaPollRepository.findById` has a different name or return shape, adjust the call rather than the repository.

- [ ] **Step 4: Manually verify the security boundary**

Start the app (`yarn dev`), create an ORGANIZATION poll as one user, attach an image, copy the `/api/poll-attachments/<id>` URL, then open it in a logged-out private window.
Expected: **404**, not the image. This is the check that matters most in this task — confirm it before moving on.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/app/api/poll-attachments
```

Mark Task 8 complete in this file, then stop and let the user review.

---

### Task 9: Generalize the markdown components — ✅ COMPLETE

**Deviations, all improvements on what was written here:**

- The PDF-vs-image decision was extracted into `buildAttachmentRef.ts` rather
  than left inline in the editor's `insertAttachment`, so the fix is unit
  testable. 8 tests, including a regression guard for the original bug.
- `detectVideoEmbed` moved to `components/markdown/` alongside the renderer
  that is its only consumer.
- Message keys moved from `report.markdown` to a top-level `markdown`
  namespace, since the renderer is now shared.
- `ReportForm`'s hardcoded `maxLength={50000}` replaced with the existing
  `REPORT_BODY_MAX_LENGTH` constant.
- `buildAttachmentRef` escapes `[` and `]` in file names; an unescaped `]`
  would terminate the link label early.

Moves the three report components to a shared location, parameterizes the API prefix, fixes the PDF-as-image bug, and adds `remark-breaks`. Reports must keep working identically apart from the two intended fixes.

**Files:**

- Create: `src/web/components/markdown/isAllowedAttachmentSrc.ts`
- Create: `src/web/components/markdown/MarkdownRenderer.tsx`
- Create: `src/web/components/markdown/MarkdownEditor.tsx`
- Create: `src/web/components/markdown/__tests__/isAllowedAttachmentSrc.test.ts`
- Delete: `src/web/components/report/isAllowedAttachmentSrc.ts`, `ReportMarkdownRenderer.tsx`, `ReportMarkdownEditor.tsx`
- Modify: every report call site of the deleted components
- Modify: `package.json` (add `remark-breaks`)

**Interfaces:**

- Produces:
  - `isAllowedAttachmentSrc(src: string, apiPrefix: string): boolean`
  - `<MarkdownRenderer source apiPrefix allowedAttachmentIds? />`
  - `<MarkdownEditor value onChange apiPrefix onUploadAttachment? maxLength? />`

- [ ] **Step 1: Install `remark-breaks`**

```bash
yarn add remark-breaks
```

- [ ] **Step 2: Write the failing test for the src allowlist**

`src/web/components/markdown/__tests__/isAllowedAttachmentSrc.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isAllowedAttachmentSrc } from '../isAllowedAttachmentSrc';

const POLLS = '/api/poll-attachments';

describe('isAllowedAttachmentSrc', () => {
  it('accepts a src under the given prefix', () => {
    expect(isAllowedAttachmentSrc('/api/poll-attachments/abc', POLLS)).toBe(
      true
    );
  });

  it('rejects an external URL', () => {
    expect(isAllowedAttachmentSrc('https://evil.example/x.png', POLLS)).toBe(
      false
    );
  });

  it('rejects a src under a different prefix', () => {
    expect(isAllowedAttachmentSrc('/api/report-attachments/abc', POLLS)).toBe(
      false
    );
  });

  it('rejects a protocol-relative URL that merely contains the prefix', () => {
    expect(
      isAllowedAttachmentSrc('//evil.example/api/poll-attachments/abc', POLLS)
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn vitest run src/web/components/markdown`
Expected: FAIL — cannot resolve `../isAllowedAttachmentSrc`.

- [ ] **Step 4: Implement the src allowlist**

`src/web/components/markdown/isAllowedAttachmentSrc.ts`:

```typescript
// Only same-origin attachment routes may render as inline images. A
// `startsWith` check on a leading-slash prefix also rejects
// protocol-relative URLs like //evil.example/api/poll-attachments/x,
// because those begin with a second slash.
export function isAllowedAttachmentSrc(
  src: string,
  apiPrefix: string
): boolean {
  return src.startsWith(`${apiPrefix}/`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn vitest run src/web/components/markdown`
Expected: PASS — 4 tests.

- [ ] **Step 6: Move and generalize the renderer**

Create `src/web/components/markdown/MarkdownRenderer.tsx` from the existing `src/web/components/report/ReportMarkdownRenderer.tsx`, with these changes and nothing else:

- Add `apiPrefix: string` to `Props`.
- Build the id regex from the prefix instead of the module constant:
  ```typescript
  const attachmentIdPattern = new RegExp(
    `${apiPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([A-Za-z0-9_-]+)`
  );
  ```
- Pass `apiPrefix` through to `isAllowedAttachmentSrc(src, apiPrefix)`.
- Add `remarkBreaks` to the plugin list:
  ```typescript
  import remarkBreaks from 'remark-breaks';
  // ...
  remarkPlugins={[remarkGfm, remarkBreaks]}
  ```
- Keep `skipHtml`, the `SANITIZE_SCHEMA`, the video-embed branch, and the external-image placeholder exactly as they are.
- Keep the translation namespace `report.markdown` for now, or move those keys to a shared `markdown` namespace and update both message files. If moving, update `messages/en.json` and `messages/ru.json` together.

- [ ] **Step 7: Move and generalize the editor, fixing the PDF bug**

Create `src/web/components/markdown/MarkdownEditor.tsx` from `ReportMarkdownEditor.tsx`, adding `apiPrefix: string` to `Props` and replacing `insertAttachment` with:

```typescript
const insertAttachment = async (file: File) => {
  if (!onUploadAttachment) {
    return;
  }

  const r = await onUploadAttachment(file);

  if ('id' in r) {
    const url = `${apiPrefix}/${r.id}`;
    // PDFs are not images: emitting image syntax for them produces a
    // broken <img>. Link syntax renders a download the browser opens in
    // its own viewer.
    const ref =
      file.type === 'application/pdf'
        ? `\n\n[${file.name}](${url})\n`
        : `\n\n![${file.name}](${url})\n`;
    onChange(value + ref);
  }
};
```

- [ ] **Step 8: Re-point the report call sites**

Find them: `grep -rn "ReportMarkdownRenderer\|ReportMarkdownEditor" --include='*.tsx' src`

Replace each with the shared component, passing `apiPrefix="/api/report-attachments"`. Then delete the three old files under `src/web/components/report/`.

- [ ] **Step 9: Verify reports still work**

Run: `yarn typecheck && yarn vitest run`
Expected: no type errors, all tests pass.

Then start the app and open an existing report with an inline image.
Expected: the image still renders; paragraph breaks now also respect single newlines; a PDF attachment inserts as a link rather than a broken image.

- [ ] **Step 10: Stage and stop for review**

```bash
git add src/web/components package.json yarn.lock messages
```

Mark Task 9 complete in this file, then stop and let the user review.

---

### Task 10: `stripMarkdown` and the poll render sites — ✅ COMPLETE

**No new `stripMarkdown` was written.** One already existed:
`stripMarkdownToPlainText`, used for report profanity checking and social
previews. It was lifted from `application/report/` to a new
`application/shared/` (polls importing from the report context would couple the
two), its "profanity checking only" comment corrected, and 4 tests added for
attachment-ref cases. Its implementation needed no change — it already handled
them, and it preserves paragraph breaks, which is better for PDF export than
the collapse-to-spaces version this plan proposed.

**Bug found and fixed in Task 4's design:** `Poll.toJSON()` spreads `props`, but
Task 4 stored `attachmentIds` outside `props` — so serialized polls silently
omitted it, which would have made every inline image on the results page render
as a blocked placeholder. `toJSON` now includes it explicitly, with two
regression tests.

`OpenPollPreview` gained `attachmentIds` so the anonymous preview can render
inline images.

**Files:**

- Create: `src/web/lib/stripMarkdown.ts`
- Create: `src/web/lib/__tests__/stripMarkdown.test.ts`
- Modify: `src/app/[locale]/polls/[pollId]/vote/page.tsx:159-163`
- Modify: `src/app/[locale]/polls/[pollId]/results/page.tsx:221-225`
- Modify: `src/web/components/polls/PublicOpenPollPreview.tsx:46-48`
- Modify: `src/web/components/polls/PollCard.tsx:251-255`
- Modify: `src/app/api/polls/[pollId]/results/pdf/route.ts:144`
- Modify: `src/app/api/polls/[pollId]/results/named-pdf/route.ts:146`

**Interfaces:**

- Consumes: `MarkdownRenderer` (Task 9)
- Produces: `stripMarkdown(source: string): string`

- [ ] **Step 1: Write the failing test**

`src/web/lib/__tests__/stripMarkdown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { stripMarkdown } from '../stripMarkdown';

describe('stripMarkdown', () => {
  it('returns plain text unchanged', () => {
    expect(stripMarkdown('Just plain text')).toBe('Just plain text');
  });

  it('reduces an image to its alt text', () => {
    expect(stripMarkdown('See ![the fence](/api/poll-attachments/a1)')).toBe(
      'See the fence'
    );
  });

  it('drops an image with no alt text', () => {
    expect(stripMarkdown('See ![](/api/poll-attachments/a1) here')).toBe(
      'See here'
    );
  });

  it('reduces a link to its label', () => {
    expect(stripMarkdown('Read [survey.pdf](/api/poll-attachments/a1)')).toBe(
      'Read survey.pdf'
    );
  });

  it('removes heading markers', () => {
    expect(stripMarkdown('## Background')).toBe('Background');
  });

  it('removes bold and italic markers', () => {
    expect(stripMarkdown('The fence was moved in **March**')).toBe(
      'The fence was moved in March'
    );
  });

  it('removes list markers', () => {
    expect(stripMarkdown('- first\n- second')).toBe('first second');
  });

  it('collapses newlines into single spaces', () => {
    expect(stripMarkdown('one\n\ntwo')).toBe('one two');
  });

  it('handles an empty string', () => {
    expect(stripMarkdown('')).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run src/web/lib/__tests__/stripMarkdown.test.ts`
Expected: FAIL — cannot resolve `../stripMarkdown`.

- [ ] **Step 3: Implement `stripMarkdown`**

`src/web/lib/stripMarkdown.ts`:

```typescript
// Markdown → plain text, for places that cannot render markup: the poll card
// preview (which line-clamps to two lines) and the results PDF export. This
// is deliberately a small regex pass rather than a full parse — it runs on
// every card in a list, and the output only needs to read as prose.
export function stripMarkdown(source: string): string {
  return (
    source
      // Images first: ![alt](url) → alt. Must precede the link rule, since
      // an image is a link with a leading '!'.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links: [label](url) → label
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Heading markers at line start
      .replace(/^#{1,6}\s+/gm, '')
      // Blockquote markers at line start
      .replace(/^>\s?/gm, '')
      // Unordered list markers at line start
      .replace(/^[\s]*[-*+]\s+/gm, '')
      // Ordered list markers at line start
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Bold / italic / inline code markers
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]*)`/g, '$1')
      // Collapse all whitespace runs, including newlines, to single spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run src/web/lib/__tests__/stripMarkdown.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Switch the three full render sites to the markdown renderer**

In `src/app/[locale]/polls/[pollId]/vote/page.tsx`, replace lines 159-163:

```tsx
{
  serializedPoll.description && (
    <div className="mt-2">
      <MarkdownRenderer
        source={serializedPoll.description}
        apiPrefix="/api/poll-attachments"
        allowedAttachmentIds={serializedPoll.attachmentIds}
      />
    </div>
  );
}
```

The page must now include `attachmentIds` in the object it serializes for the client (a plain `string[]` — never the bytes).

Apply the equivalent change in `results/page.tsx` (lines 221-225) and `PublicOpenPollPreview.tsx` (lines 46-48), dropping `text-center` from the preview since long prose should not be centered.

- [ ] **Step 6: Strip markdown in the card**

In `src/web/components/polls/PollCard.tsx`, replace lines 251-255:

```tsx
{
  poll.description && (
    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
      {stripMarkdown(poll.description)}
    </p>
  );
}
```

- [ ] **Step 7: Strip markdown in the PDF exports**

In `src/app/api/polls/[pollId]/results/pdf/route.ts:144` and `named-pdf/route.ts:146`, wrap the value:

```typescript
pollDescription: stripMarkdown(poll.description ?? ''),
```

`protocol-pdf/route.ts` does not use the description and needs no change.

- [ ] **Step 8: Verify**

Run: `yarn typecheck && yarn vitest run`
Expected: no type errors, all tests pass.

Then start the app, open a poll with a markdown description containing an image and a PDF link.
Expected: the image renders inline, the PDF shows as a link, the card in the poll list shows clean prose with no `![...]` syntax, and the results PDF contains readable text.

- [ ] **Step 9: Stage and stop for review**

```bash
git add src/web src/app
```

Mark Task 10 complete in this file, then stop and let the user review.

---

### Task 11: Markdown editor in the edit form — ✅ COMPLETE

Upload failures now surface under the editor via `attachmentError` state; the
route already returns a localized message, so nothing is hardcoded. The
now-orphaned `Textarea` import was removed. Not manually exercised in a browser
— see the note under Task 8 about restarting the dev server first.

The edit form is done first because it always has a poll id — no modal needed. That keeps the upload path proven before the create form's extra complexity is added.

**Files:**

- Modify: `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx:872-888`

**Interfaces:**

- Consumes: `MarkdownEditor` (Task 9), `POST /api/poll-attachments` (Task 8)

- [ ] **Step 1: Replace the textarea with the editor**

In `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx`, replace the `<Textarea>` block (lines 874-884) with:

```tsx
<MarkdownEditor
  value={pollData.description}
  onChange={(next) => {
    setPollData({ ...pollData, description: next });
    setFieldErrors(undefined);
  }}
  apiPrefix="/api/poll-attachments"
  maxLength={POLL_DESCRIPTION_MAX_LENGTH}
  onUploadAttachment={async (file) => {
    const fd = new FormData();
    fd.append('pollId', pollId);
    fd.append('file', file);

    const res = await fetch('/api/poll-attachments', {
      method: 'POST',
      body: fd,
    });
    const json = await res.json();

    return res.ok ? { id: json.id } : { error: json.error };
  }}
/>
```

Import `MarkdownEditor` and `POLL_DESCRIPTION_MAX_LENGTH` at the top of the file. `pollId` is already available in this component.

- [ ] **Step 2: Surface upload failures to the user**

The editor's `onUploadAttachment` returns `{ error }` on failure but the current editor silently ignores it. Add local state in the form and render the message under the editor:

```tsx
{
  attachmentError && <p className="text-sm text-red-600">{attachmentError}</p>;
}
```

Set it from the `{ error }` branch of the upload callback and clear it on the next successful upload. The message arrives already localized from `translateErrorCode` in the route.

- [ ] **Step 3: Verify end to end**

Run: `yarn typecheck`, then start the app.

Edit a DRAFT poll, paste an image into the description.
Expected: it uploads, a `![name](/api/poll-attachments/<id>)` ref appears, and the preview pane shows the image. Save, then reload the poll — the image still renders.

Then attach a PDF.
Expected: it inserts as `[name](...)` and renders as a link, not a broken image.

Then try to edit an ACTIVE poll's description.
Expected: blocked, as it already is today.

- [ ] **Step 4: Stage and stop for review**

```bash
git add src/app
```

Mark Task 11 complete in this file, then stop and let the user review.

---

### Task 12: Markdown editor and draft-save modal in the create form — ✅ COMPLETE

**Two deviations, both correcting real bugs this plan would have caused:**

1. **No `router.replace` to the edit page after the draft save.** The create
   form holds questions in local React state and the draft save persists only
   the poll, so navigating away would silently discard every question the
   author had typed. The form now stays put, tracks `draftPollId`, and the
   final submit calls `updatePollAction` instead of `createPollAction` when a
   draft already exists — which is also what keeps a second poll from being
   created.

2. **Fields with no update path are now locked once a draft exists.**
   `updatePollAction` persists only title, description and dates. Weight
   configuration is therefore synced separately via
   `updatePollWeightConfigAction`; poll type, anonymity, organization and board
   have no update path at all (`anonymous` is deliberately set-once), so those
   controls are disabled with an explanatory note once the draft is saved.
   Without this, an author who attached a file early and then switched the poll
   to anonymous would have had that choice silently discarded — on a legal
   voting record, where anonymity decides who may see who voted how.

**Files:**

- Create: `src/web/components/polls/SaveDraftBeforeAttachModal.tsx`
- Modify: `src/app/[locale]/polls/create/CreatePollForm.tsx:704-720`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `MarkdownEditor` (Task 9), the create poll server action already used by this form
- Produces: `<SaveDraftBeforeAttachModal open onSave onCancel saving error? />`

- [ ] **Step 1: Add the modal's messages**

`messages/en.json`, under a new `poll.saveDraftModal` object:

```json
"saveDraftModal": {
  "title": "Save a draft first",
  "body": "The poll must be saved as a draft before files can be attached. Your current entries will be kept.",
  "save": "Save draft",
  "cancel": "Cancel"
}
```

`messages/ru.json`:

```json
"saveDraftModal": {
  "title": "Сначала сохраните черновик",
  "body": "Чтобы прикреплять файлы, голосование нужно сохранить как черновик. Введённые данные сохранятся.",
  "save": "Сохранить черновик",
  "cancel": "Отмена"
}
```

- [ ] **Step 2: Build the modal**

`src/web/components/polls/SaveDraftBeforeAttachModal.tsx`, using the Catalyst dialog components in `src/web/components/catalyst`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from '@/web/components/catalyst/dialog';
import { Button } from '@/web/components/catalyst/button';

interface Props {
  open: boolean;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onCancel: () => void;
}

export function SaveDraftBeforeAttachModal({
  open,
  saving,
  error,
  onSave,
  onCancel,
}: Props) {
  const t = useTranslations('poll.saveDraftModal');

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogBody>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('body')}</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

Catalyst `Button` already carries pointer styling, so no explicit `cursor-pointer` is needed here.

- [ ] **Step 3: Wire the deferred-upload flow into the create form**

In `src/app/[locale]/polls/create/CreatePollForm.tsx`, replace the `<Textarea>` (lines 706-716) with `MarkdownEditor` configured exactly as in Task 11, except that `onUploadAttachment` first ensures a poll id exists:

```tsx
const [draftPollId, setDraftPollId] = useState<string | null>(null);
const [modalOpen, setModalOpen] = useState(false);
const [savingDraft, setSavingDraft] = useState(false);
const [draftError, setDraftError] = useState<string | undefined>();
const pendingFileRef = useRef<File | null>(null);
const pendingResolveRef = useRef<
  ((r: { id: string } | { error: string }) => void) | null
>(null);

async function uploadTo(pollId: string, file: File) {
  const fd = new FormData();
  fd.append('pollId', pollId);
  fd.append('file', file);

  const res = await fetch('/api/poll-attachments', {
    method: 'POST',
    body: fd,
  });
  const json = await res.json();

  return res.ok ? { id: json.id as string } : { error: json.error as string };
}

const handleUploadAttachment = (file: File) => {
  if (draftPollId) {
    return uploadTo(draftPollId, file);
  }

  // No poll id yet — hold the file, open the modal, and resolve this promise
  // once the draft is saved (or the user cancels).
  return new Promise<{ id: string } | { error: string }>((resolve) => {
    pendingFileRef.current = file;
    pendingResolveRef.current = resolve;
    setDraftError(undefined);
    setModalOpen(true);
  });
};
```

The modal's handlers:

```tsx
const handleSaveDraft = async () => {
  setSavingDraft(true);
  setDraftError(undefined);

  // Reuses the same create action the form's normal submit uses, so the
  // required-field validation is identical.
  const result = await createDraftFromCurrentForm();

  setSavingDraft(false);

  if (!result.success) {
    // Keep the modal open so the user can see which field is missing.
    setDraftError(result.error);

    return;
  }

  setDraftPollId(result.pollId);
  setModalOpen(false);

  const file = pendingFileRef.current;
  const resolve = pendingResolveRef.current;
  pendingFileRef.current = null;
  pendingResolveRef.current = null;

  if (file && resolve) {
    resolve(await uploadTo(result.pollId, file));
  }

  // Switch to edit mode so the next submit updates this poll instead of
  // creating a second one, and so a reload does not lose the draft.
  router.replace(`/polls/${result.pollId}/edit`);
};

const handleCancelDraft = () => {
  setModalOpen(false);

  const resolve = pendingResolveRef.current;
  pendingFileRef.current = null;
  pendingResolveRef.current = null;

  // Resolving with an error means the editor inserts no ref — the pasted
  // file simply does not appear.
  resolve?.({ error: '' });
};
```

`createDraftFromCurrentForm` extracts the poll-creation half of the existing submit handler (`CreatePollForm.tsx:404-429`) so both paths build identical `FormData` and hit the same validation. Note it deliberately skips the question loop that follows at line 431 — a DRAFT poll with no questions is valid, since `POLL_NO_QUESTIONS` is only enforced on the DRAFT → READY transition:

```tsx
async function createDraftFromCurrentForm(): Promise<
  { success: true; pollId: string } | { success: false; error: string }
> {
  const pollFormData = new FormData();
  pollFormData.append('title', pollData.title);
  pollFormData.append('description', pollData.description);
  pollFormData.append('organizationId', pollData.organizationId);

  if (pollData.boardId) {
    pollFormData.append('boardId', pollData.boardId);
  }

  pollFormData.append('startDate', pollData.startDate);
  pollFormData.append('endDate', pollData.endDate);
  pollFormData.append('pollType', pollType);
  pollFormData.append('anonymous', String(anonymous));
  pollFormData.append('distributionType', distributionType);
  pollFormData.append('propertyAggregation', propertyAggregation);
  pollFormData.append('propertyIds', JSON.stringify(propertyIds));

  const pollResult = await createPollAction(pollFormData);

  if (!pollResult.success) {
    setFieldErrors(pollResult.fieldErrors);

    return { success: false, error: pollResult.error };
  }

  return { success: true, pollId: pollResult.data.pollId };
}
```

Refactor the existing submit handler to call this function for its own poll-creation step rather than duplicating the block, so the two paths cannot drift apart.

Render the modal at the end of the form's JSX:

```tsx
<SaveDraftBeforeAttachModal
  open={modalOpen}
  saving={savingDraft}
  error={draftError}
  onSave={handleSaveDraft}
  onCancel={handleCancelDraft}
/>
```

- [ ] **Step 4: Verify the whole flow by hand**

Run: `yarn typecheck`, then start the app and walk these cases:

1. Create a poll, fill in title and description text, paste an image.
   Expected: the modal appears; Save creates one DRAFT, the upload succeeds, the ref is inserted, and the URL becomes `/polls/<id>/edit`.
2. Create a poll, leave the title empty, paste an image, press Save.
   Expected: the modal stays open showing the title-required error; no poll is created.
3. Create a poll, paste an image, press Cancel.
   Expected: the modal closes, no poll is created, and no ref is inserted into the description.
4. After a successful draft save, paste a second image.
   Expected: it uploads immediately with no modal.
5. Complete and submit the poll after a draft save.
   Expected: exactly one poll exists, not two.

Case 5 is the one most likely to be wrong — verify the poll count in the database, not just the UI.

- [ ] **Step 5: Run the full suite**

Run: `yarn vitest run`
Expected: all tests pass.

- [ ] **Step 6: Stage and stop for review**

```bash
git add src messages
```

Mark Task 12 complete in this file, then stop and let the user review.

---

## Deferred (explicitly not in this plan)

From the spec, decided against for now:

- **Truncating the description before the AI legality prompt.** At 10 000 characters a check costs roughly 4% of the daily token cap, which is affordable. Revisit if `legal_check_daily_token_cap` starts being hit.
- **Server-side truncation of descriptions in list queries.** ~400 KB for a 20-card page is tolerable. Worth doing if poll lists feel slow.
- **Relaxing the description-required invariant for DRAFT polls.** Only needed if the "description cannot be empty" modal error proves annoying in practice.
- Audio and video uploads, Range-request support, transcoding, thumbnailing, embedded PDF viewers.
