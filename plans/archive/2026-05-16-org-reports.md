# Organization Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Markdown-based reports feature for organizations: any org member can author; admin must publish; visibility picker (public-anon, public-auth, within-org [4 hierarchy modes], within-board(s)); many-to-many polls; inline image/PDF attachments; embedded video URLs (YouTube/Vimeo/Rutube/VK).

**Architecture:** New `Report` bounded context under `src/domain/report/` (DDD). Aggregate root + state machine (Draft ↔ Published, archive terminal). Inline `bytea` for attachments (mirrors `PropertyClaimAttachment`). Server-side visibility resolution in `ResolveReportVisibilityService` reused by pages, actions, and the attachment route. Anonymous reads served at `/r/[id]`; logged-in routes at `/[locale]/reports/*`.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 + PostgreSQL, next-intl, Tailwind + Catalyst, vitest. New runtime deps: `@uiw/react-md-editor`, `react-markdown`, `remark-gfm`, `rehype-sanitize`.

**Spec:** `readmes/2026-05-16-org-reports-design.md`

**Branch:** `sesolaga/reports` (off `dev`).

**Project rules to remember:**

- Per `CLAUDE.md`: **NEVER `git commit`** — `git add` is fine. After each task, stage changes; the user commits.
- Per `CLAUDE.md`: **Ask for confirmation before any file edit/write/bash that modifies the filesystem.**
- Per `CLAUDE.md`: archive only; never `DELETE`. Cascade rules use `ON DELETE CASCADE` for parent-org/parent-report removal (irrelevant for archive flows).
- All clickable native `<button>`/`<a>` MUST include `cursor-pointer` (+ `disabled:cursor-not-allowed` when applicable).
- Server actions begin with `await checkRateLimit()` and use `translateErrorCode` for error mapping.
- Localize every UI string — no hardcoded literals.
- All domain logic returns `Result<T, string>` where the error is a dotted code translatable via `messages/*.json`.

---

## File structure

### New domain files (`src/domain/report/`)

| Path                            | Responsibility                                     |
| ------------------------------- | -------------------------------------------------- |
| `ReportDomainCodes.ts`          | Dotted error codes for the Report bounded context  |
| `ReportVisibility.ts`           | Enum + helper predicates                           |
| `ReportVideoLink.ts`            | Value object: validates URL + detects provider     |
| `ReportAttachment.ts`           | Entity: mime whitelist, size cap, magic-byte check |
| `Report.ts`                     | Aggregate root + state machine                     |
| `ReportRepository.ts`           | Repository interface                               |
| `ReportAttachmentRepository.ts` | Repository interface for attachments               |

### New application files (`src/application/report/`)

| Path                                | Responsibility                                       |
| ----------------------------------- | ---------------------------------------------------- |
| `ReportErrors.ts`                   | Application-layer error codes                        |
| `StripMarkdownToPlainText.ts`       | Strips md syntax → text for profanity check          |
| `ResolveReportVisibilityService.ts` | `canRead(report, viewer)`; reused by every read path |
| `CreateReportUseCase.ts`            | Initial Draft create                                 |
| `UpdateReportUseCase.ts`            | Title + body in Draft                                |
| `SetReportVisibilityUseCase.ts`     | Visibility + boards in Draft                         |
| `AttachPollUseCase.ts`              | Add poll with audience-superset rule                 |
| `DetachPollUseCase.ts`              | Remove poll link                                     |
| `AddReportAttachmentUseCase.ts`     | Magic-byte + size + count check, persist             |
| `RemoveReportAttachmentUseCase.ts`  | Delete attachment row                                |
| `AddReportVideoLinkUseCase.ts`      | URL validation + provider detect                     |
| `RemoveReportVideoLinkUseCase.ts`   | Delete row                                           |
| `PublishReportUseCase.ts`           | Admin-only; sets `lastPublishedAt`, optional notify  |
| `DowngradeReportToDraftUseCase.ts`  | Author or admin; preserves `lastPublishedAt`         |
| `ArchiveReportUseCase.ts`           | Author or admin                                      |
| `GetReportForViewerUseCase.ts`      | Read one; visibility-checked                         |
| `ListReportsForViewerUseCase.ts`    | Feed; visibility-checked; pagination                 |
| `NotifyReportPublishedUseCase.ts`   | Fan out `Notification` rows                          |

### New infrastructure files (`src/infrastructure/repositories/`)

| Path                                  | Responsibility                                                  |
| ------------------------------------- | --------------------------------------------------------------- |
| `PrismaReportRepository.ts`           | CRUD + search; rebuilds aggregate including boards/polls/videos |
| `PrismaReportAttachmentRepository.ts` | Mirrors `PrismaPropertyClaimAttachmentRepository`               |

### New web files

| Path                                                   | Responsibility                                   |
| ------------------------------------------------------ | ------------------------------------------------ |
| `src/web/actions/report/report.ts`                     | All server actions for the report feature        |
| `src/web/components/report/ReportMarkdownEditor.tsx`   | Client component wrapping `@uiw/react-md-editor` |
| `src/web/components/report/ReportMarkdownRenderer.tsx` | Markdown rendering + video embed + sanitization  |
| `src/web/components/report/VisibilityPicker.tsx`       | Radio group for the 7 visibility values          |
| `src/web/components/report/BoardsMultiPicker.tsx`      | Multi-select boards (filters by org)             |
| `src/web/components/report/PollPicker.tsx`             | Multi-select polls with subset filtering         |
| `src/web/components/report/AttachmentUploader.tsx`     | File picker + upload progress                    |
| `src/web/components/report/VideoLinkInput.tsx`         | URL field + provider detect                      |
| `src/web/components/report/ReportForm.tsx`             | Composes all editor pieces                       |
| `src/web/components/report/ReportCard.tsx`             | Listing tile                                     |
| `src/web/components/report/ReportDetail.tsx`           | Detail view                                      |
| `src/web/components/report/ReportsSection.tsx`         | Section embedded on org detail page              |
| `src/web/components/report/ReportStateBadge.tsx`       | Draft/Published badge                            |
| `src/app/[locale]/reports/page.tsx`                    | Global feed                                      |
| `src/app/[locale]/reports/new/page.tsx`                | Create form                                      |
| `src/app/[locale]/reports/[id]/page.tsx`               | Detail view                                      |
| `src/app/[locale]/reports/[id]/edit/page.tsx`          | Edit form                                        |
| `src/app/r/[id]/page.tsx`                              | Locale-agnostic anon route                       |
| `src/app/api/report-attachments/route.ts`              | POST upload                                      |
| `src/app/api/report-attachments/[id]/route.ts`         | GET download/inline                              |
| `src/app/sitemap.ts`                                   | Public-anon report URLs                          |

### Modified files

| Path                                                      | Change                                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                    | Add `Report`, `ReportAttachment`, `ReportVideoLink`, `ReportPoll`, `ReportBoard` models; relations to `Organization`, `User`, `Board`, `Poll`, `Notification` |
| `prisma/migrations/<timestamp>_add_reports/migration.sql` | DDL                                                                                                                                                           |
| `src/infrastructure/index.ts`                             | Export new repositories                                                                                                                                       |
| `src/infrastructure/rateLimit/registry.ts`                | Add `reportCreateLimiter`                                                                                                                                     |
| `src/app/[locale]/organizations/[id]/page.tsx`            | Render `<ReportsSection />`                                                                                                                                   |
| `src/i18n/locales.ts`                                     | No change (locales already present)                                                                                                                           |
| `messages/en.json`                                        | Add `report.*` namespace + `domain.report.*` codes                                                                                                            |
| `messages/ru.json`                                        | Same                                                                                                                                                          |
| `package.json`                                            | New deps                                                                                                                                                      |

---

## Phase 1 — Schema and Domain Foundation

### Task 1.1 — Add Prisma models

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1.1: Add enum and models near the end of the file**

After the existing `enum OverallRisk` block, add:

```prisma
enum ReportVisibility {
  PUBLIC_ANON
  PUBLIC_AUTH
  WITHIN_ORG_ONLY
  WITHIN_ORG_ANCESTORS
  WITHIN_ORG_DESCENDANTS
  WITHIN_ORG_TREE
  WITHIN_BOARDS

  @@map("report_visibility_enum")
}

enum ReportState {
  DRAFT
  PUBLISHED

  @@map("report_state_enum")
}
```

Before the last `}` of the file, add the report models:

```prisma
model Report {
  id              String           @id @default(cuid())
  organizationId  String           @map("organization_id")
  createdById     String           @map("created_by_id")
  title           String
  body            String
  visibility      ReportVisibility
  state           ReportState      @default(DRAFT)
  publishedById   String?          @map("published_by_id")
  lastPublishedAt DateTime?        @map("last_published_at")
  notifyAudience  Boolean          @default(false) @map("notify_audience")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  archivedAt      DateTime?        @map("archived_at")

  organization Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy    User                @relation("ReportAuthor", fields: [createdById], references: [id])
  publishedBy  User?               @relation("ReportPublisher", fields: [publishedById], references: [id], onDelete: SetNull)
  attachments  ReportAttachment[]
  videoLinks   ReportVideoLink[]
  boards       ReportBoard[]
  polls        ReportPoll[]

  @@index([organizationId])
  @@index([createdById])
  @@index([state, archivedAt])
  @@index([visibility, state, lastPublishedAt])
  @@map("reports")
}

model ReportAttachment {
  id        String   @id @default(cuid())
  reportId  String   @map("report_id")
  fileName  String   @map("file_name")
  mimeType  String   @map("mime_type")
  sizeBytes Int      @map("size_bytes")
  bytes     Bytes
  createdAt DateTime @default(now()) @map("created_at")

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@map("report_attachments")
}

model ReportVideoLink {
  id        String   @id @default(cuid())
  reportId  String   @map("report_id")
  url       String
  provider  String
  createdAt DateTime @default(now()) @map("created_at")

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@map("report_video_links")
}

model ReportBoard {
  reportId String @map("report_id")
  boardId  String @map("board_id")

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)
  board  Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@id([reportId, boardId])
  @@index([boardId])
  @@map("report_boards")
}

model ReportPoll {
  reportId String @map("report_id")
  pollId   String @map("poll_id")

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)
  poll   Poll   @relation(fields: [pollId], references: [id], onDelete: Cascade)

  @@id([reportId, pollId])
  @@index([pollId])
  @@map("report_polls")
}
```

- [ ] **Step 1.1.2: Add inverse relations to existing models**

In `model User`, add inside the relations block:

```prisma
  reportsAuthored  Report[] @relation("ReportAuthor")
  reportsPublished Report[] @relation("ReportPublisher")
```

In `model Organization`, add:

```prisma
  reports Report[]
```

In `model Board`, add:

```prisma
  reportBoards ReportBoard[]
```

In `model Poll`, add:

```prisma
  reportPolls ReportPoll[]
```

- [ ] **Step 1.1.3: Run schema validation**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 1.1.4: Stage**

```bash
git add prisma/schema.prisma
```

### Task 1.2 — Generate migration

**Files:**

- Create: `prisma/migrations/<timestamp>_add_reports/migration.sql`

- [ ] **Step 1.2.1: Generate migration SQL only (do not apply yet)**

Run: `npx prisma migrate dev --create-only --name add_reports`
Expected: a new migration directory under `prisma/migrations/` with a `migration.sql`.

- [ ] **Step 1.2.2: Inspect generated SQL**

Read the new `migration.sql`. Verify it creates:

- `report_visibility_enum`, `report_state_enum` enums
- `reports`, `report_attachments`, `report_video_links`, `report_boards`, `report_polls` tables
- FKs with `ON DELETE CASCADE` to organizations / reports / boards / polls
- FK `published_by_id → users(id)` with `ON DELETE SET NULL`
- Indexes listed in the schema

If anything is missing or non-cascading where it shouldn't be, edit `migration.sql` directly before applying.

- [ ] **Step 1.2.3: Apply migration in dev**

Run: `npx prisma migrate dev`
Expected: migration applied, `prisma generate` re-runs, no errors.

- [ ] **Step 1.2.4: Stage**

```bash
git add prisma/migrations/
```

### Task 1.3 — Domain error codes

**Files:**

- Create: `src/domain/report/ReportDomainCodes.ts`

- [ ] **Step 1.3.1: Write the codes module**

```ts
export const ReportDomainCodes = {
  REPORT_TITLE_EMPTY: 'domain.report.titleEmpty',
  REPORT_TITLE_TOO_LONG: 'domain.report.titleTooLong',
  REPORT_BODY_EMPTY: 'domain.report.bodyEmpty',
  REPORT_BODY_TOO_LONG: 'domain.report.bodyTooLong',

  REPORT_INVALID_VISIBILITY: 'domain.report.invalidVisibility',
  REPORT_BOARDS_EMPTY: 'domain.report.boardsEmpty',
  REPORT_BOARD_NOT_IN_ORG: 'domain.report.boardNotInOrg',

  REPORT_MUST_BE_DRAFT: 'domain.report.mustBeDraft',
  REPORT_MUST_BE_PUBLISHED: 'domain.report.mustBePublished',
  REPORT_CANNOT_EDIT_PUBLISHED: 'domain.report.cannotEditPublished',
  REPORT_ALREADY_ARCHIVED: 'domain.report.alreadyArchived',
  REPORT_ARCHIVED: 'domain.report.archived',

  REPORT_ATTACHMENT_FILENAME_EMPTY: 'domain.report.attachmentFilenameEmpty',
  REPORT_ATTACHMENT_TOO_LARGE: 'domain.report.attachmentTooLarge',
  REPORT_ATTACHMENT_TYPE_NOT_ALLOWED: 'domain.report.attachmentTypeNotAllowed',
  REPORT_ATTACHMENT_MAGIC_MISMATCH: 'domain.report.attachmentMagicMismatch',
  REPORT_ATTACHMENT_LIMIT_REACHED: 'domain.report.attachmentLimitReached',

  REPORT_VIDEO_URL_INVALID: 'domain.report.videoUrlInvalid',
  REPORT_VIDEO_LIMIT_REACHED: 'domain.report.videoLimitReached',
  REPORT_VIDEO_NOT_FOUND: 'domain.report.videoNotFound',

  REPORT_POLL_AUDIENCE_TOO_NARROW: 'domain.report.pollAudienceTooNarrow',
  REPORT_POLL_NOT_FOUND: 'domain.report.pollNotFound',
} as const;

export type ReportDomainCode =
  (typeof ReportDomainCodes)[keyof typeof ReportDomainCodes];
```

- [ ] **Step 1.3.2: Stage**

```bash
git add src/domain/report/ReportDomainCodes.ts
```

### Task 1.4 — `ReportVisibility` value object

**Files:**

- Create: `src/domain/report/ReportVisibility.ts`
- Create: `src/domain/report/__tests__/ReportVisibility.test.ts`

- [ ] **Step 1.4.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  ReportVisibility,
  isPublicVisibility,
  isWithinOrgVisibility,
  isHierarchyVisibility,
} from '../ReportVisibility';

describe('ReportVisibility', () => {
  it('exposes seven values', () => {
    expect(Object.values(ReportVisibility).sort()).toEqual(
      [
        'PUBLIC_ANON',
        'PUBLIC_AUTH',
        'WITHIN_ORG_ONLY',
        'WITHIN_ORG_ANCESTORS',
        'WITHIN_ORG_DESCENDANTS',
        'WITHIN_ORG_TREE',
        'WITHIN_BOARDS',
      ].sort()
    );
  });

  it('classifies public values', () => {
    expect(isPublicVisibility(ReportVisibility.PUBLIC_ANON)).toBe(true);
    expect(isPublicVisibility(ReportVisibility.PUBLIC_AUTH)).toBe(true);
    expect(isPublicVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(false);
    expect(isPublicVisibility(ReportVisibility.WITHIN_BOARDS)).toBe(false);
  });

  it('classifies within-org values', () => {
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(true);
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_ANCESTORS)).toBe(
      true
    );
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_DESCENDANTS)).toBe(
      true
    );
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_ORG_TREE)).toBe(true);
    expect(isWithinOrgVisibility(ReportVisibility.PUBLIC_ANON)).toBe(false);
    expect(isWithinOrgVisibility(ReportVisibility.WITHIN_BOARDS)).toBe(false);
  });

  it('classifies hierarchy-expanding values', () => {
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_ANCESTORS)).toBe(
      true
    );
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_DESCENDANTS)).toBe(
      true
    );
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_TREE)).toBe(true);
    expect(isHierarchyVisibility(ReportVisibility.WITHIN_ORG_ONLY)).toBe(false);
    expect(isHierarchyVisibility(ReportVisibility.PUBLIC_ANON)).toBe(false);
  });
});
```

- [ ] **Step 1.4.2: Run tests; expect failure**

Run: `yarn test src/domain/report/__tests__/ReportVisibility.test.ts`
Expected: FAIL — file `../ReportVisibility` not found.

- [ ] **Step 1.4.3: Write the module**

```ts
export const ReportVisibility = {
  PUBLIC_ANON: 'PUBLIC_ANON',
  PUBLIC_AUTH: 'PUBLIC_AUTH',
  WITHIN_ORG_ONLY: 'WITHIN_ORG_ONLY',
  WITHIN_ORG_ANCESTORS: 'WITHIN_ORG_ANCESTORS',
  WITHIN_ORG_DESCENDANTS: 'WITHIN_ORG_DESCENDANTS',
  WITHIN_ORG_TREE: 'WITHIN_ORG_TREE',
  WITHIN_BOARDS: 'WITHIN_BOARDS',
} as const;

export type ReportVisibility =
  (typeof ReportVisibility)[keyof typeof ReportVisibility];

export const ALL_REPORT_VISIBILITIES: readonly ReportVisibility[] = [
  ReportVisibility.PUBLIC_ANON,
  ReportVisibility.PUBLIC_AUTH,
  ReportVisibility.WITHIN_ORG_ONLY,
  ReportVisibility.WITHIN_ORG_ANCESTORS,
  ReportVisibility.WITHIN_ORG_DESCENDANTS,
  ReportVisibility.WITHIN_ORG_TREE,
  ReportVisibility.WITHIN_BOARDS,
];

export function isPublicVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.PUBLIC_ANON || v === ReportVisibility.PUBLIC_AUTH
  );
}

export function isWithinOrgVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.WITHIN_ORG_ONLY ||
    v === ReportVisibility.WITHIN_ORG_ANCESTORS ||
    v === ReportVisibility.WITHIN_ORG_DESCENDANTS ||
    v === ReportVisibility.WITHIN_ORG_TREE
  );
}

export function isHierarchyVisibility(v: ReportVisibility): boolean {
  return (
    v === ReportVisibility.WITHIN_ORG_ANCESTORS ||
    v === ReportVisibility.WITHIN_ORG_DESCENDANTS ||
    v === ReportVisibility.WITHIN_ORG_TREE
  );
}
```

- [ ] **Step 1.4.4: Run tests; expect pass**

Run: `yarn test src/domain/report/__tests__/ReportVisibility.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 1.4.5: Stage**

```bash
git add src/domain/report/ReportVisibility.ts src/domain/report/__tests__/ReportVisibility.test.ts
```

### Task 1.5 — `ReportVideoLink` value object

**Files:**

- Create: `src/domain/report/ReportVideoLink.ts`
- Create: `src/domain/report/__tests__/ReportVideoLink.test.ts`

- [ ] **Step 1.5.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { ReportVideoLink } from '../ReportVideoLink';
import { ReportDomainCodes } from '../ReportDomainCodes';

describe('ReportVideoLink', () => {
  it('detects youtube URLs', () => {
    const r = ReportVideoLink.create(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.value.provider).toBe('youtube');
      expect(r.value.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
  });

  it('detects youtu.be short URLs', () => {
    const r = ReportVideoLink.create('https://youtu.be/dQw4w9WgXcQ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.value.provider).toBe('youtube');
  });

  it('detects vimeo URLs', () => {
    const r = ReportVideoLink.create('https://vimeo.com/123456789');
    expect(r.success).toBe(true);
    if (r.success) expect(r.value.provider).toBe('vimeo');
  });

  it('detects rutube URLs', () => {
    const r = ReportVideoLink.create('https://rutube.ru/video/abc123def');
    expect(r.success).toBe(true);
    if (r.success) expect(r.value.provider).toBe('rutube');
  });

  it('detects vk URLs', () => {
    const r = ReportVideoLink.create('https://vk.com/video-12345_67890');
    expect(r.success).toBe(true);
    if (r.success) expect(r.value.provider).toBe('vk');
  });

  it('rejects http (non-https)', () => {
    const r = ReportVideoLink.create('http://www.youtube.com/watch?v=abc');
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_VIDEO_URL_INVALID);
  });

  it('rejects unknown providers', () => {
    const r = ReportVideoLink.create('https://example.com/video.mp4');
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_VIDEO_URL_INVALID);
  });

  it('rejects malformed URLs', () => {
    const r = ReportVideoLink.create('not a url');
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 1.5.2: Run tests; expect failure**

Run: `yarn test src/domain/report/__tests__/ReportVideoLink.test.ts`
Expected: FAIL.

- [ ] **Step 1.5.3: Write the module**

```ts
import { Result, success, failure } from '../shared/Result';
import { ReportDomainCodes } from './ReportDomainCodes';

export type VideoProvider = 'youtube' | 'vimeo' | 'rutube' | 'vk';

const PROVIDER_PATTERNS: { provider: VideoProvider; pattern: RegExp }[] = [
  {
    provider: 'youtube',
    pattern:
      /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{6,}/,
  },
  {
    provider: 'vimeo',
    pattern: /^https:\/\/(www\.)?vimeo\.com\/\d+/,
  },
  {
    provider: 'rutube',
    pattern: /^https:\/\/rutube\.ru\/video\/\w{6,}/,
  },
  {
    provider: 'vk',
    pattern: /^https:\/\/(www\.)?vk\.com\/(video[-\d_]+|video\?z=video[-\d_]+)/,
  },
];

export class ReportVideoLink {
  private constructor(
    public readonly id: string | null,
    public readonly reportId: string | null,
    public readonly url: string,
    public readonly provider: VideoProvider,
    public readonly createdAt: Date | null
  ) {}

  static create(
    url: string,
    reportId: string | null = null
  ): Result<ReportVideoLink, string> {
    const trimmed = url.trim();
    const match = PROVIDER_PATTERNS.find((p) => p.pattern.test(trimmed));
    if (!match) {
      return failure(ReportDomainCodes.REPORT_VIDEO_URL_INVALID);
    }
    return success(
      new ReportVideoLink(null, reportId, trimmed, match.provider, null)
    );
  }

  static reconstitute(input: {
    id: string;
    reportId: string;
    url: string;
    provider: string;
    createdAt: Date;
  }): ReportVideoLink {
    return new ReportVideoLink(
      input.id,
      input.reportId,
      input.url,
      input.provider as VideoProvider,
      input.createdAt
    );
  }
}
```

- [ ] **Step 1.5.4: Run tests; expect pass**

Run: `yarn test src/domain/report/__tests__/ReportVideoLink.test.ts`
Expected: PASS.

- [ ] **Step 1.5.5: Stage**

```bash
git add src/domain/report/ReportVideoLink.ts src/domain/report/__tests__/ReportVideoLink.test.ts
```

### Task 1.6 — `ReportAttachment` entity

**Files:**

- Create: `src/domain/report/ReportAttachment.ts`
- Create: `src/domain/report/__tests__/ReportAttachment.test.ts`

This mirrors `PropertyClaimAttachment` precisely. See `src/domain/organization/PropertyClaimAttachment.ts` for the magic-byte verification reference implementation.

- [ ] **Step 1.6.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  ReportAttachment,
  REPORT_ATTACHMENT_IMAGE_MAX_BYTES,
  REPORT_ATTACHMENT_PDF_MAX_BYTES,
} from '../ReportAttachment';
import { ReportDomainCodes } from '../ReportDomainCodes';

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF_HEADER = Buffer.from('%PDF-1.4');
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
]);

describe('ReportAttachment', () => {
  it('accepts a valid PNG', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([PNG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid JPEG', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      bytes: Buffer.concat([JPEG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid WebP', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.webp',
      mimeType: 'image/webp',
      bytes: Buffer.concat([WEBP_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid PDF', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.concat([PDF_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('rejects oversized image', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([
        PNG_HEADER,
        Buffer.alloc(REPORT_ATTACHMENT_IMAGE_MAX_BYTES + 1),
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
  });

  it('rejects oversized PDF', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.concat([
        PDF_HEADER,
        Buffer.alloc(REPORT_ATTACHMENT_PDF_MAX_BYTES + 1),
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
  });

  it('rejects disallowed mime', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.gif',
      mimeType: 'image/gif',
      bytes: Buffer.from([0x47, 0x49, 0x46, 0x38]),
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(
        ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED
      );
  });

  it('rejects magic-byte mismatch (PNG declared, JPEG bytes)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([JPEG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
  });

  it('rejects empty filename', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: '   ',
      mimeType: 'image/png',
      bytes: Buffer.concat([PNG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_FILENAME_EMPTY);
  });
});
```

- [ ] **Step 1.6.2: Run tests; expect failure**

Run: `yarn test src/domain/report/__tests__/ReportAttachment.test.ts`
Expected: FAIL.

- [ ] **Step 1.6.3: Write the module**

Adapt the implementation of `src/domain/organization/PropertyClaimAttachment.ts`, replacing:

- ZIP support is **removed** for reports (not in the mime whitelist).
- Images and PDFs have **different size caps** (5 MB and 10 MB respectively).
- Constants prefixed `REPORT_ATTACHMENT_*`.
- Error codes from `ReportDomainCodes`.

```ts
import { Result, success, failure } from '../shared/Result';
import { ReportDomainCodes } from './ReportDomainCodes';

export const REPORT_ATTACHMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const REPORT_ATTACHMENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const REPORT_ATTACHMENT_COUNT_LIMIT = 20;

export const REPORT_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export type ReportAttachmentMimeType =
  (typeof REPORT_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

const MAGIC_HEADER_PREFIX_BYTES = 12;

function maxBytesFor(mimeType: string): number {
  return mimeType === 'application/pdf'
    ? REPORT_ATTACHMENT_PDF_MAX_BYTES
    : REPORT_ATTACHMENT_IMAGE_MAX_BYTES;
}

function magicMatches(mimeType: string, head: Buffer): boolean {
  switch (mimeType) {
    case 'image/png':
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
      return (
        head.length >= 3 &&
        head[0] === 0xff &&
        head[1] === 0xd8 &&
        head[2] === 0xff
      );
    case 'image/webp':
      return (
        head.length >= 12 &&
        head.toString('ascii', 0, 4) === 'RIFF' &&
        head.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'application/pdf':
      return head.length >= 5 && head.toString('ascii', 0, 5) === '%PDF-';
    default:
      return false;
  }
}

interface CreateInput {
  reportId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface CreateWithBytesInput {
  reportId: string;
  fileName: string;
  mimeType: string;
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

export class ReportAttachment {
  private constructor(
    public readonly id: string | null,
    public readonly reportId: string,
    public readonly fileName: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    public readonly createdAt: Date | null
  ) {}

  static create(input: CreateInput): Result<ReportAttachment, string> {
    const trimmed = input.fileName.trim();
    if (trimmed.length === 0) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_FILENAME_EMPTY);
    }
    if (
      !(REPORT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(
        input.mimeType
      )
    ) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED);
    }
    if (input.sizeBytes > maxBytesFor(input.mimeType)) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
    }
    return success(
      new ReportAttachment(
        null,
        input.reportId,
        trimmed,
        input.mimeType,
        input.sizeBytes,
        null
      )
    );
  }

  static createWithBytes(
    input: CreateWithBytesInput
  ): Result<ReportAttachment, string> {
    const meta = ReportAttachment.create({
      reportId: input.reportId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
    });
    if (!meta.success) return meta;

    const head = input.bytes.subarray(0, MAGIC_HEADER_PREFIX_BYTES);
    if (!magicMatches(input.mimeType, head)) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
    }
    return success(meta.value);
  }

  static reconstitute(input: ReconstituteInput): ReportAttachment {
    return new ReportAttachment(
      input.id,
      input.reportId,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.createdAt
    );
  }
}
```

- [ ] **Step 1.6.4: Run tests; expect pass**

Run: `yarn test src/domain/report/__tests__/ReportAttachment.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 1.6.5: Stage**

```bash
git add src/domain/report/ReportAttachment.ts src/domain/report/__tests__/ReportAttachment.test.ts
```

### Task 1.7 — `Report` aggregate root and state machine

**Files:**

- Create: `src/domain/report/Report.ts`
- Create: `src/domain/report/__tests__/Report.test.ts`

- [ ] **Step 1.7.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  Report,
  REPORT_TITLE_MAX_LENGTH,
  REPORT_BODY_MAX_LENGTH,
} from '../Report';
import { ReportVisibility } from '../ReportVisibility';
import { ReportDomainCodes } from '../ReportDomainCodes';

const make = (overrides: Partial<Parameters<typeof Report.create>[0]> = {}) =>
  Report.create({
    title: 'Title',
    body: 'Body',
    organizationId: 'org-1',
    createdById: 'user-1',
    visibility: ReportVisibility.WITHIN_ORG_ONLY,
    boardIds: [],
    ...overrides,
  });

describe('Report.create', () => {
  it('creates a Draft report with valid input', () => {
    const r = make();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.value.state).toBe('DRAFT');
      expect(r.value.title).toBe('Title');
      expect(r.value.visibility).toBe(ReportVisibility.WITHIN_ORG_ONLY);
      expect(r.value.lastPublishedAt).toBeNull();
      expect(r.value.publishedById).toBeNull();
      expect(r.value.archivedAt).toBeNull();
    }
  });

  it('rejects empty title', () => {
    const r = make({ title: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe(ReportDomainCodes.REPORT_TITLE_EMPTY);
  });

  it('rejects title too long', () => {
    const r = make({ title: 'a'.repeat(REPORT_TITLE_MAX_LENGTH + 1) });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_TITLE_TOO_LONG);
  });

  it('rejects empty body', () => {
    const r = make({ body: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe(ReportDomainCodes.REPORT_BODY_EMPTY);
  });

  it('rejects body too long', () => {
    const r = make({ body: 'a'.repeat(REPORT_BODY_MAX_LENGTH + 1) });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_BODY_TOO_LONG);
  });

  it('rejects WITHIN_BOARDS visibility without boardIds', () => {
    const r = make({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe(ReportDomainCodes.REPORT_BOARDS_EMPTY);
  });

  it('accepts WITHIN_BOARDS with boards', () => {
    const r = make({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'b2'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.value.boardIds).toEqual(['b1', 'b2']);
  });
});

describe('Report state machine', () => {
  it('publish: DRAFT → PUBLISHED, sets publishedBy + lastPublishedAt', () => {
    const r = make().value!;
    const before = new Date();
    const res = r.publish('admin-1', false);
    expect(res.success).toBe(true);
    expect(r.state).toBe('PUBLISHED');
    expect(r.publishedById).toBe('admin-1');
    expect(r.lastPublishedAt).not.toBeNull();
    expect(r.lastPublishedAt!.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
  });

  it('publish: rejects when not Draft', () => {
    const r = make().value!;
    r.publish('admin-1', false);
    const second = r.publish('admin-1', false);
    expect(second.success).toBe(false);
    if (!second.success)
      expect(second.error).toBe(ReportDomainCodes.REPORT_MUST_BE_DRAFT);
  });

  it('publish: forces notifyAudience=false for PUBLIC_ANON', () => {
    const r = make({ visibility: ReportVisibility.PUBLIC_ANON }).value!;
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(false);
  });

  it('publish: forces notifyAudience=false for PUBLIC_AUTH', () => {
    const r = make({ visibility: ReportVisibility.PUBLIC_AUTH }).value!;
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(false);
  });

  it('publish: honors notifyAudience for WITHIN_ORG_ONLY', () => {
    const r = make().value!;
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(true);
  });

  it('downgrade: PUBLISHED → DRAFT preserves lastPublishedAt; clears publishedById; resets notifyAudience', () => {
    const r = make().value!;
    r.publish('admin-1', true);
    const lastPub = r.lastPublishedAt;
    const res = r.downgradeToDraft();
    expect(res.success).toBe(true);
    expect(r.state).toBe('DRAFT');
    expect(r.publishedById).toBeNull();
    expect(r.notifyAudience).toBe(false);
    expect(r.lastPublishedAt).toEqual(lastPub);
  });

  it('downgrade: rejects when not Published', () => {
    const r = make().value!;
    const res = r.downgradeToDraft();
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error).toBe(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
  });

  it('archive: sets archivedAt', () => {
    const r = make().value!;
    const res = r.archive();
    expect(res.success).toBe(true);
    expect(r.archivedAt).not.toBeNull();
    expect(r.isArchived()).toBe(true);
  });

  it('archive: rejects double archive', () => {
    const r = make().value!;
    r.archive();
    const second = r.archive();
    expect(second.success).toBe(false);
    if (!second.success)
      expect(second.error).toBe(ReportDomainCodes.REPORT_ALREADY_ARCHIVED);
  });
});

describe('Report editing constraints', () => {
  it('updateTitle: allowed in Draft', () => {
    const r = make().value!;
    const res = r.updateTitle('New');
    expect(res.success).toBe(true);
    expect(r.title).toBe('New');
  });

  it('updateTitle: rejected in Published', () => {
    const r = make().value!;
    r.publish('admin-1', false);
    const res = r.updateTitle('New');
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
  });

  it('setVisibility: rejected in Published', () => {
    const r = make().value!;
    r.publish('admin-1', false);
    const res = r.setVisibility(ReportVisibility.PUBLIC_AUTH, []);
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
  });

  it('setVisibility: WITHIN_BOARDS requires boardIds', () => {
    const r = make().value!;
    const res = r.setVisibility(ReportVisibility.WITHIN_BOARDS, []);
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error).toBe(ReportDomainCodes.REPORT_BOARDS_EMPTY);
  });
});
```

- [ ] **Step 1.7.2: Run tests; expect failure**

Run: `yarn test src/domain/report/__tests__/Report.test.ts`
Expected: FAIL.

- [ ] **Step 1.7.3: Write the aggregate**

```ts
import { Result, success, failure } from '../shared/Result';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ReportDomainCodes } from './ReportDomainCodes';
import { ReportVisibility, isPublicVisibility } from './ReportVisibility';

export const REPORT_TITLE_MAX_LENGTH = 200;
export const REPORT_BODY_MAX_LENGTH = 50_000;

export type ReportState = 'DRAFT' | 'PUBLISHED';

export interface ReportProps {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  state: ReportState;
  publishedById: string | null;
  lastPublishedAt: Date | null;
  notifyAudience: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  boardIds: string[];
  pollIds: string[];
  attachmentIds: string[];
  videoLinkIds: string[];
}

export interface CreateReportInput {
  title: string;
  body: string;
  organizationId: string;
  createdById: string;
  visibility: ReportVisibility;
  boardIds: string[];
  profanityChecker?: ProfanityChecker;
  stripMarkdownToPlainText?: (md: string) => string;
}

export class Report {
  private constructor(private props: ReportProps) {}

  static create(input: CreateReportInput): Result<Report, string> {
    const titleCheck = validateTitle(input.title, input.profanityChecker);
    if (!titleCheck.success) return failure(titleCheck.error);

    const bodyCheck = validateBody(
      input.body,
      input.profanityChecker,
      input.stripMarkdownToPlainText
    );
    if (!bodyCheck.success) return failure(bodyCheck.error);

    if (
      input.visibility === ReportVisibility.WITHIN_BOARDS &&
      input.boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }

    const now = new Date();
    return success(
      new Report({
        id: '',
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: input.title.trim(),
        body: input.body,
        visibility: input.visibility,
        state: 'DRAFT',
        publishedById: null,
        lastPublishedAt: null,
        notifyAudience: false,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        boardIds:
          input.visibility === ReportVisibility.WITHIN_BOARDS
            ? [...input.boardIds]
            : [],
        pollIds: [],
        attachmentIds: [],
        videoLinkIds: [],
      })
    );
  }

  static reconstitute(props: ReportProps): Report {
    return new Report(props);
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get createdById() {
    return this.props.createdById;
  }
  get title() {
    return this.props.title;
  }
  get body() {
    return this.props.body;
  }
  get visibility() {
    return this.props.visibility;
  }
  get state() {
    return this.props.state;
  }
  get publishedById() {
    return this.props.publishedById;
  }
  get lastPublishedAt() {
    return this.props.lastPublishedAt;
  }
  get notifyAudience() {
    return this.props.notifyAudience;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get boardIds() {
    return [...this.props.boardIds];
  }
  get pollIds() {
    return [...this.props.pollIds];
  }
  get attachmentIds() {
    return [...this.props.attachmentIds];
  }
  get videoLinkIds() {
    return [...this.props.videoLinkIds];
  }

  isDraft(): boolean {
    return this.props.state === 'DRAFT';
  }
  isPublished(): boolean {
    return this.props.state === 'PUBLISHED';
  }
  isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  updateTitle(
    newTitle: string,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    const v = validateTitle(newTitle, profanityChecker);
    if (!v.success) return failure(v.error);
    this.props.title = newTitle.trim();
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  updateBody(
    newBody: string,
    profanityChecker?: ProfanityChecker,
    stripMarkdownToPlainText?: (md: string) => string
  ): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    const v = validateBody(newBody, profanityChecker, stripMarkdownToPlainText);
    if (!v.success) return failure(v.error);
    this.props.body = newBody;
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  setVisibility(
    visibility: ReportVisibility,
    boardIds: string[]
  ): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    if (
      visibility === ReportVisibility.WITHIN_BOARDS &&
      boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }
    this.props.visibility = visibility;
    this.props.boardIds =
      visibility === ReportVisibility.WITHIN_BOARDS ? [...boardIds] : [];
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  attachPoll(pollId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    if (!this.props.pollIds.includes(pollId)) this.props.pollIds.push(pollId);
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  detachPoll(pollId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    this.props.pollIds = this.props.pollIds.filter((p) => p !== pollId);
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  attachAttachment(attachmentId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    this.props.attachmentIds.push(attachmentId);
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  detachAttachment(attachmentId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    this.props.attachmentIds = this.props.attachmentIds.filter(
      (a) => a !== attachmentId
    );
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  attachVideoLink(linkId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    this.props.videoLinkIds.push(linkId);
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  detachVideoLink(linkId: string): Result<void, string> {
    if (!this.isDraft())
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    this.props.videoLinkIds = this.props.videoLinkIds.filter(
      (v) => v !== linkId
    );
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  publish(
    publishedById: string,
    notifyAudience: boolean
  ): Result<void, string> {
    if (this.isArchived()) return failure(ReportDomainCodes.REPORT_ARCHIVED);
    if (!this.isDraft()) return failure(ReportDomainCodes.REPORT_MUST_BE_DRAFT);
    const now = new Date();
    this.props.state = 'PUBLISHED';
    this.props.publishedById = publishedById;
    this.props.lastPublishedAt = now;
    this.props.notifyAudience = isPublicVisibility(this.props.visibility)
      ? false
      : notifyAudience;
    this.props.updatedAt = now;
    return success(undefined);
  }

  downgradeToDraft(): Result<void, string> {
    if (this.isArchived()) return failure(ReportDomainCodes.REPORT_ARCHIVED);
    if (!this.isPublished())
      return failure(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
    this.props.state = 'DRAFT';
    this.props.publishedById = null;
    this.props.notifyAudience = false;
    this.props.updatedAt = new Date();
    return success(undefined);
  }

  archive(): Result<void, string> {
    if (this.isArchived())
      return failure(ReportDomainCodes.REPORT_ALREADY_ARCHIVED);
    this.props.archivedAt = new Date();
    this.props.updatedAt = this.props.archivedAt;
    return success(undefined);
  }
}

function validateTitle(
  title: string,
  profanityChecker?: ProfanityChecker
): Result<void, string> {
  if (!title || title.trim().length === 0) {
    return failure(ReportDomainCodes.REPORT_TITLE_EMPTY);
  }
  if (title.length > REPORT_TITLE_MAX_LENGTH) {
    return failure(ReportDomainCodes.REPORT_TITLE_TOO_LONG);
  }
  if (profanityChecker?.containsProfanity(title.trim())) {
    return failure(SharedDomainCodes.CONTAINS_PROFANITY);
  }
  return success(undefined);
}

function validateBody(
  body: string,
  profanityChecker?: ProfanityChecker,
  stripMarkdownToPlainText?: (md: string) => string
): Result<void, string> {
  if (!body || body.trim().length === 0) {
    return failure(ReportDomainCodes.REPORT_BODY_EMPTY);
  }
  if (body.length > REPORT_BODY_MAX_LENGTH) {
    return failure(ReportDomainCodes.REPORT_BODY_TOO_LONG);
  }
  if (profanityChecker) {
    const text = stripMarkdownToPlainText
      ? stripMarkdownToPlainText(body)
      : body;
    if (profanityChecker.containsProfanity(text)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  }
  return success(undefined);
}
```

- [ ] **Step 1.7.4: Run tests; expect pass**

Run: `yarn test src/domain/report/__tests__/Report.test.ts`
Expected: PASS, ~14 tests.

- [ ] **Step 1.7.5: Stage**

```bash
git add src/domain/report/Report.ts src/domain/report/__tests__/Report.test.ts
```

### Task 1.8 — Repository interfaces

**Files:**

- Create: `src/domain/report/ReportRepository.ts`
- Create: `src/domain/report/ReportAttachmentRepository.ts`

- [ ] **Step 1.8.1: Write `ReportRepository.ts`**

```ts
import { Report } from './Report';
import { ReportVisibility } from './ReportVisibility';
import { ReportVideoLink } from './ReportVideoLink';
import { Result } from '../shared/Result';

export interface ReportSearchFilters {
  organizationIds?: string[];
  visibilities?: ReportVisibility[];
  state?: 'DRAFT' | 'PUBLISHED';
  includeArchived?: boolean;
  authorId?: string;
  page?: number;
  pageSize?: number;
}

export interface ReportSearchResult {
  reports: Report[];
  totalCount: number;
}

export interface ReportRepository {
  create(report: Report): Promise<Result<Report, string>>;
  update(report: Report): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<Report | null, string>>;
  /**
   * List public-anon PUBLISHED non-archived reports for sitemap generation.
   * Returns ids + lastPublishedAt only — no body / attachments.
   */
  listPublicAnonForSitemap(): Promise<
    Result<Array<{ id: string; lastPublishedAt: Date }>, string>
  >;
  search(
    filters: ReportSearchFilters
  ): Promise<Result<ReportSearchResult, string>>;
  addVideoLink(link: ReportVideoLink): Promise<Result<ReportVideoLink, string>>;
  removeVideoLink(id: string): Promise<Result<void, string>>;
  countVideoLinks(reportId: string): Promise<Result<number, string>>;
  /**
   * Hydrate full Report including boards, polls, attachments (metadata-only),
   * and video links.
   */
  findByIdWithRelations(id: string): Promise<Result<Report | null, string>>;
}
```

- [ ] **Step 1.8.2: Write `ReportAttachmentRepository.ts`**

```ts
import { ReportAttachment } from './ReportAttachment';
import { Result } from '../shared/Result';

export interface ReportAttachmentMetadata {
  id: string;
  reportId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface ReportAttachmentBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface ReportAttachmentRepository {
  save(
    attachment: ReportAttachment,
    bytes: Buffer
  ): Promise<Result<ReportAttachmentMetadata, string>>;
  findByReportId(
    reportId: string
  ): Promise<Result<ReportAttachmentMetadata[], string>>;
  findBytesById(
    id: string
  ): Promise<Result<ReportAttachmentBytes | null, string>>;
  findById(
    id: string
  ): Promise<Result<ReportAttachmentMetadata | null, string>>;
  countByReportId(reportId: string): Promise<Result<number, string>>;
  deleteById(id: string): Promise<Result<void, string>>;
}
```

- [ ] **Step 1.8.3: Stage**

```bash
git add src/domain/report/ReportRepository.ts src/domain/report/ReportAttachmentRepository.ts
```

### Task 1.9 — Phase 1 wrap

- [ ] **Step 1.9.1: Run full test suite**

Run: `yarn test`
Expected: no regressions.

- [ ] **Step 1.9.2: Run typecheck**

Run: `yarn typecheck`
Expected: pass.

- [ ] **Step 1.9.3: Mark Phase 1 complete**

In this plan file, under the Phase 1 heading append `**Phase 1 complete.**`. Stop and let the user review.

---

## Phase 2 — Infrastructure

### Task 2.1 — `PrismaReportRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaReportRepository.ts`
- Create: `src/infrastructure/repositories/__tests__/PrismaReportRepository.test.ts` (optional smoke test; skip if test-DB not available — flag in commit)

- [ ] **Step 2.1.1: Write the repository**

```ts
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import {
  ReportRepository,
  ReportSearchFilters,
  ReportSearchResult,
} from '../../domain/report/ReportRepository';
import { ReportVideoLink } from '../../domain/report/ReportVideoLink';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export class PrismaReportRepository implements ReportRepository {
  constructor(private prisma: PrismaClient) {}

  async create(report: Report): Promise<Result<Report, string>> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.report.create({
          data: {
            organizationId: report.organizationId,
            createdById: report.createdById,
            title: report.title,
            body: report.body,
            visibility: report.visibility,
            state: report.state,
            publishedById: report.publishedById,
            lastPublishedAt: report.lastPublishedAt,
            notifyAudience: report.notifyAudience,
            archivedAt: report.archivedAt,
          },
        });
        if (report.boardIds.length > 0) {
          await tx.reportBoard.createMany({
            data: report.boardIds.map((boardId) => ({
              reportId: created.id,
              boardId,
            })),
          });
        }
        return created;
      });
      return success(this.hydrate(result, [], [], []));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async update(report: Report): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.update({
          where: { id: report.id },
          data: {
            title: report.title,
            body: report.body,
            visibility: report.visibility,
            state: report.state,
            publishedById: report.publishedById,
            lastPublishedAt: report.lastPublishedAt,
            notifyAudience: report.notifyAudience,
            archivedAt: report.archivedAt,
          },
        });
        // Replace boards
        await tx.reportBoard.deleteMany({ where: { reportId: report.id } });
        if (report.boardIds.length > 0) {
          await tx.reportBoard.createMany({
            data: report.boardIds.map((boardId) => ({
              reportId: report.id,
              boardId,
            })),
          });
        }
        // Replace polls
        await tx.reportPoll.deleteMany({ where: { reportId: report.id } });
        if (report.pollIds.length > 0) {
          await tx.reportPoll.createMany({
            data: report.pollIds.map((pollId) => ({
              reportId: report.id,
              pollId,
            })),
          });
        }
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(id: string): Promise<Result<Report | null, string>> {
    return this.findByIdWithRelations(id);
  }

  async findByIdWithRelations(
    id: string
  ): Promise<Result<Report | null, string>> {
    try {
      const row = await this.prisma.report.findUnique({
        where: { id },
        include: {
          boards: { select: { boardId: true } },
          polls: { select: { pollId: true } },
          attachments: { select: { id: true } },
          videoLinks: { select: { id: true } },
        },
      });
      if (!row) return success(null);
      return success(
        this.hydrate(
          row,
          row.boards.map((b) => b.boardId),
          row.polls.map((p) => p.pollId),
          row.attachments.map((a) => a.id),
          row.videoLinks.map((v) => v.id)
        )
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async listPublicAnonForSitemap(): Promise<
    Result<Array<{ id: string; lastPublishedAt: Date }>, string>
  > {
    try {
      const rows = await this.prisma.report.findMany({
        where: {
          visibility: 'PUBLIC_ANON',
          state: 'PUBLISHED',
          archivedAt: null,
          lastPublishedAt: { not: null },
        },
        select: { id: true, lastPublishedAt: true },
        orderBy: { lastPublishedAt: 'desc' },
      });
      return success(
        rows.map((r) => ({ id: r.id, lastPublishedAt: r.lastPublishedAt! }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async search(
    filters: ReportSearchFilters
  ): Promise<Result<ReportSearchResult, string>> {
    try {
      const where: Prisma.ReportWhereInput = {};
      if (filters.organizationIds && filters.organizationIds.length > 0) {
        where.organizationId = { in: filters.organizationIds };
      }
      if (filters.visibilities && filters.visibilities.length > 0) {
        where.visibility = { in: filters.visibilities as ReportVisibility[] };
      }
      if (filters.state) where.state = filters.state;
      if (!filters.includeArchived) where.archivedAt = null;
      if (filters.authorId) where.createdById = filters.authorId;

      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      const [rows, totalCount] = await Promise.all([
        this.prisma.report.findMany({
          where,
          orderBy: [{ lastPublishedAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: pageSize,
          include: {
            boards: { select: { boardId: true } },
            polls: { select: { pollId: true } },
            attachments: { select: { id: true } },
            videoLinks: { select: { id: true } },
          },
        }),
        this.prisma.report.count({ where }),
      ]);

      return success({
        reports: rows.map((row) =>
          this.hydrate(
            row,
            row.boards.map((b) => b.boardId),
            row.polls.map((p) => p.pollId),
            row.attachments.map((a) => a.id),
            row.videoLinks.map((v) => v.id)
          )
        ),
        totalCount,
      });
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async addVideoLink(
    link: ReportVideoLink
  ): Promise<Result<ReportVideoLink, string>> {
    try {
      const created = await this.prisma.reportVideoLink.create({
        data: {
          reportId: link.reportId!,
          url: link.url,
          provider: link.provider,
        },
      });
      return success(
        ReportVideoLink.reconstitute({
          id: created.id,
          reportId: created.reportId,
          url: created.url,
          provider: created.provider,
          createdAt: created.createdAt,
        })
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async removeVideoLink(id: string): Promise<Result<void, string>> {
    try {
      await this.prisma.reportVideoLink.delete({ where: { id } });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countVideoLinks(reportId: string): Promise<Result<number, string>> {
    try {
      const count = await this.prisma.reportVideoLink.count({
        where: { reportId },
      });
      return success(count);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  private hydrate(
    row: {
      id: string;
      organizationId: string;
      createdById: string;
      title: string;
      body: string;
      visibility: string;
      state: string;
      publishedById: string | null;
      lastPublishedAt: Date | null;
      notifyAudience: boolean;
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    },
    boardIds: string[],
    pollIds: string[],
    attachmentIds: string[],
    videoLinkIds: string[] = []
  ): Report {
    return Report.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      createdById: row.createdById,
      title: row.title,
      body: row.body,
      visibility: row.visibility as ReportVisibility,
      state: row.state as 'DRAFT' | 'PUBLISHED',
      publishedById: row.publishedById,
      lastPublishedAt: row.lastPublishedAt,
      notifyAudience: row.notifyAudience,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
      boardIds,
      pollIds,
      attachmentIds,
      videoLinkIds,
    });
  }
}
```

- [ ] **Step 2.1.2: Stage**

```bash
git add src/infrastructure/repositories/PrismaReportRepository.ts
```

### Task 2.2 — `PrismaReportAttachmentRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaReportAttachmentRepository.ts`

- [ ] **Step 2.2.1: Write the repository** (mirror `PrismaPropertyClaimAttachmentRepository` exactly, swap table name)

```ts
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
      if (!row) return success(null);
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
```

- [ ] **Step 2.2.2: Stage**

```bash
git add src/infrastructure/repositories/PrismaReportAttachmentRepository.ts
```

### Task 2.3 — Wire up exports and rate limiter

**Files:**

- Modify: `src/infrastructure/index.ts`
- Modify: `src/infrastructure/rateLimit/registry.ts`

- [ ] **Step 2.3.1: Add exports**

Append to `src/infrastructure/index.ts`:

```ts
export { PrismaReportRepository } from './repositories/PrismaReportRepository';
export { PrismaReportAttachmentRepository } from './repositories/PrismaReportAttachmentRepository';
```

- [ ] **Step 2.3.2: Add rate limiter**

Open `src/infrastructure/rateLimit/registry.ts`. Locate the section where other named limiters are exported (e.g. `phoneSearchLimiter`). Add a `reportCreateLimiter` with a 24-hour window, 10 requests, label `reportCreate`. Mirror existing call shape.

If the file's structure is unclear when you open it, the new limiter must:

- be invoked as `reportCreateLimiter.check(\`user:${userId}\`)`
- return `{ allowed: boolean; retryAfterSeconds: number }`
- be exported from the same module so it can be imported by `web/actions/report/report.ts`

- [ ] **Step 2.3.3: Stage**

```bash
git add src/infrastructure/index.ts src/infrastructure/rateLimit/registry.ts
```

### Task 2.4 — Phase 2 wrap

- [ ] **Step 2.4.1: Typecheck**

Run: `yarn typecheck`
Expected: pass.

- [ ] **Step 2.4.2: Mark Phase 2 complete**

Append `**Phase 2 complete.**` under the Phase 2 heading. Stop and let the user review.

---

## Phase 3 — Application Layer

### Task 3.1 — Application errors and helpers

**Files:**

- Create: `src/application/report/ReportErrors.ts`
- Create: `src/application/report/StripMarkdownToPlainText.ts`
- Create: `src/application/report/__tests__/StripMarkdownToPlainText.test.ts`

- [ ] **Step 3.1.1: Write `ReportErrors.ts`**

```ts
export const ReportErrors = {
  NOT_AUTHENTICATED: 'common.errors.unauthorized',
  NOT_ORG_MEMBER: 'organization.errors.notMember',
  NOT_ORG_ADMIN: 'organization.errors.notAdmin',
  NOT_AUTHOR_OR_ADMIN: 'report.errors.notAuthorOrAdmin',
  REPORT_NOT_FOUND: 'report.errors.notFound',
  ATTACHMENT_NOT_FOUND: 'report.errors.attachmentNotFound',
  RATE_LIMITED_DAILY: 'report.errors.rateLimitedDaily',
} as const;
```

- [ ] **Step 3.1.2: Write failing tests for `StripMarkdownToPlainText`**

````ts
import { describe, it, expect } from 'vitest';
import { stripMarkdownToPlainText } from '../StripMarkdownToPlainText';

describe('stripMarkdownToPlainText', () => {
  it('strips heading hashes', () => {
    expect(stripMarkdownToPlainText('# Hello\n## World')).toContain('Hello');
    expect(stripMarkdownToPlainText('# Hello\n## World')).toContain('World');
    expect(stripMarkdownToPlainText('# Hello\n## World')).not.toContain('#');
  });

  it('strips bold and italic markers', () => {
    expect(stripMarkdownToPlainText('**bold** and _italic_')).toBe(
      'bold and italic'
    );
  });

  it('strips link syntax keeping text', () => {
    expect(stripMarkdownToPlainText('[text](https://example.com)')).toBe(
      'text'
    );
  });

  it('strips image syntax keeping alt text', () => {
    expect(stripMarkdownToPlainText('![alt](https://x/y.png)')).toBe('alt');
  });

  it('strips code blocks (content kept; fences removed)', () => {
    expect(stripMarkdownToPlainText('```js\nconsole.log("x")\n```')).toContain(
      'console.log'
    );
    expect(
      stripMarkdownToPlainText('```js\nconsole.log("x")\n```')
    ).not.toContain('```');
  });

  it('keeps plain paragraphs intact', () => {
    expect(stripMarkdownToPlainText('Just a paragraph.')).toBe(
      'Just a paragraph.'
    );
  });
});
````

- [ ] **Step 3.1.3: Run; expect failure**

Run: `yarn test src/application/report/__tests__/StripMarkdownToPlainText.test.ts`
Expected: FAIL.

- [ ] **Step 3.1.4: Implement**

````ts
// Lightweight md → plaintext stripper for profanity checking only.
// NOT a full markdown parser; trades fidelity for zero deps + speed.
export function stripMarkdownToPlainText(md: string): string {
  let s = md;
  // Code fences (keep inner content but drop fences and language tag)
  s = s.replace(/```[\w-]*\n?/g, '');
  // Inline code
  s = s.replace(/`([^`]*)`/g, '$1');
  // Images ![alt](url) → alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Bold/italic markers
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  // Headings, blockquotes, list markers at line start
  s = s.replace(/^[ \t]*(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/gm, '');
  // Horizontal rules
  s = s.replace(/^[ \t]*([-*_]\s*){3,}[ \t]*$/gm, '');
  // Collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}
````

- [ ] **Step 3.1.5: Run; expect pass**

Run: `yarn test src/application/report/__tests__/StripMarkdownToPlainText.test.ts`
Expected: PASS.

- [ ] **Step 3.1.6: Stage**

```bash
git add src/application/report/ReportErrors.ts src/application/report/StripMarkdownToPlainText.ts src/application/report/__tests__/StripMarkdownToPlainText.test.ts
```

### Task 3.2 — `ResolveReportVisibilityService`

This service centralizes the read-permission check. **Reused by every read path.**

**Files:**

- Create: `src/application/report/ResolveReportVisibilityService.ts`
- Create: `src/application/report/__tests__/ResolveReportVisibilityService.test.ts`

- [ ] **Step 3.2.1: Write failing tests** (cover the seven visibility branches × draft/published × overrides for author/admin/superadmin)

Skeleton:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ResolveReportVisibilityService } from '../ResolveReportVisibilityService';
import { Report } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';

class FakeOrgRepo {
  members = new Map<string, Set<string>>(); // orgId -> userIds
  admins = new Map<string, Set<string>>(); // orgId -> userIds
  ancestors = new Map<string, string[]>();
  descendants = new Map<string, string[]>();

  async isUserMember(userId: string, orgId: string) {
    return this.members.get(orgId)?.has(userId) ?? false;
  }
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.get(orgId)?.has(userId) ?? false;
  }
  async getAncestorIds(orgId: string) {
    return this.ancestors.get(orgId) ?? [];
  }
  async getDescendantIds(orgId: string) {
    return this.descendants.get(orgId) ?? [];
  }
  async getOrgTreeIds(orgId: string) {
    return [
      orgId,
      ...(this.ancestors.get(orgId) ?? []),
      ...(this.descendants.get(orgId) ?? []),
    ];
  }
}
class FakeBoardRepo {
  members = new Map<string, Set<string>>(); // boardId -> userIds
  async isUserMember(userId: string, boardId: string) {
    return this.members.get(boardId)?.has(userId) ?? false;
  }
}
class FakeUserRepo {
  superadmins = new Set<string>();
  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

const baseProps = (
  overrides: Partial<Parameters<typeof Report.reconstitute>[0]> = {}
) => ({
  id: 'r1',
  organizationId: 'org-1',
  createdById: 'author-1',
  title: 't',
  body: 'b',
  visibility: ReportVisibility.WITHIN_ORG_ONLY,
  state: 'PUBLISHED' as const,
  publishedById: 'admin-1',
  lastPublishedAt: new Date(),
  notifyAudience: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  boardIds: [],
  pollIds: [],
  attachmentIds: [],
  videoLinkIds: [],
  ...overrides,
});

describe('ResolveReportVisibilityService.canRead', () => {
  let svc: ResolveReportVisibilityService;
  let orgs: FakeOrgRepo;
  let boards: FakeBoardRepo;
  let users: FakeUserRepo;

  beforeEach(() => {
    orgs = new FakeOrgRepo();
    boards = new FakeBoardRepo();
    users = new FakeUserRepo();
    svc = new ResolveReportVisibilityService(
      orgs as any,
      boards as any,
      users as any
    );
  });

  it('PUBLIC_ANON: anon viewer can read PUBLISHED', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_ANON })
    );
    expect(await svc.canRead(r, null)).toBe(true);
  });

  it('PUBLIC_ANON: anon viewer cannot read DRAFT', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_ANON, state: 'DRAFT' })
    );
    expect(await svc.canRead(r, null)).toBe(false);
  });

  it('PUBLIC_AUTH: anon viewer cannot read', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_AUTH })
    );
    expect(await svc.canRead(r, null)).toBe(false);
  });

  it('PUBLIC_AUTH: any logged-in user can read', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_AUTH })
    );
    expect(await svc.canRead(r, 'random-user')).toBe(true);
  });

  it('WITHIN_ORG_ONLY: org member can read; non-member cannot', async () => {
    orgs.members.set('org-1', new Set(['u1']));
    const r = Report.reconstitute(baseProps());
    expect(await svc.canRead(r, 'u1')).toBe(true);
    expect(await svc.canRead(r, 'u2')).toBe(false);
  });

  it('WITHIN_ORG_ANCESTORS: parent-org member can read', async () => {
    orgs.ancestors.set('org-1', ['parent-1']);
    orgs.members.set('parent-1', new Set(['u-parent']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_ANCESTORS })
    );
    expect(await svc.canRead(r, 'u-parent')).toBe(true);
  });

  it('WITHIN_ORG_DESCENDANTS: child-org member can read', async () => {
    orgs.descendants.set('org-1', ['child-1']);
    orgs.members.set('child-1', new Set(['u-child']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_DESCENDANTS })
    );
    expect(await svc.canRead(r, 'u-child')).toBe(true);
  });

  it('WITHIN_ORG_TREE: any tree-member can read', async () => {
    orgs.ancestors.set('org-1', ['parent-1']);
    orgs.descendants.set('org-1', ['child-1']);
    orgs.members.set('parent-1', new Set(['u-parent']));
    orgs.members.set('child-1', new Set(['u-child']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_TREE })
    );
    expect(await svc.canRead(r, 'u-parent')).toBe(true);
    expect(await svc.canRead(r, 'u-child')).toBe(true);
  });

  it('WITHIN_BOARDS: member of any listed board can read', async () => {
    boards.members.set('b1', new Set(['u-b1']));
    boards.members.set('b2', new Set(['u-b2']));
    const r = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1', 'b2'],
      })
    );
    expect(await svc.canRead(r, 'u-b1')).toBe(true);
    expect(await svc.canRead(r, 'u-b2')).toBe(true);
    expect(await svc.canRead(r, 'u-other')).toBe(false);
  });

  it('override: author reads own report in any state', async () => {
    const r = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1'],
        state: 'DRAFT',
      })
    );
    expect(await svc.canRead(r, 'author-1')).toBe(true);
  });

  it('override: org admin reads draft', async () => {
    orgs.admins.set('org-1', new Set(['admin-1']));
    const r = Report.reconstitute(baseProps({ state: 'DRAFT' }));
    expect(await svc.canRead(r, 'admin-1')).toBe(true);
  });

  it('override: superadmin reads any', async () => {
    users.superadmins.add('su');
    const r = Report.reconstitute(baseProps({ state: 'DRAFT' }));
    expect(await svc.canRead(r, 'su')).toBe(true);
  });

  it('archived report: nobody reads except author/admin/superadmin', async () => {
    orgs.members.set('org-1', new Set(['u1']));
    const r = Report.reconstitute(baseProps({ archivedAt: new Date() }));
    expect(await svc.canRead(r, 'u1')).toBe(false);
    expect(await svc.canRead(r, 'author-1')).toBe(true);
  });
});
```

- [ ] **Step 3.2.2: Run; expect failure**

Run: `yarn test src/application/report/__tests__/ResolveReportVisibilityService.test.ts`
Expected: FAIL.

- [ ] **Step 3.2.3: Implement**

```ts
import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export interface OrgRepoForVisibility {
  isUserMember(userId: string, orgId: string): Promise<boolean>;
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
  getAncestorIds(orgId: string): Promise<string[]>;
  getDescendantIds(orgId: string): Promise<string[]>;
  getOrgTreeIds(orgId: string): Promise<string[]>;
}

export interface BoardRepoForVisibility {
  isUserMember(userId: string, boardId: string): Promise<boolean>;
}

export interface UserRepoForVisibility {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export class ResolveReportVisibilityService {
  constructor(
    private orgs: OrgRepoForVisibility,
    private boards: BoardRepoForVisibility,
    private users: UserRepoForVisibility
  ) {}

  async canRead(report: Report, viewerId: string | null): Promise<boolean> {
    // Overrides (logged-in only)
    if (viewerId) {
      if (report.createdById === viewerId) return true;
      if (await this.users.isSuperAdmin(viewerId)) return true;
      if (await this.orgs.isUserAdmin(viewerId, report.organizationId))
        return true;
    }
    // Archived → only overrides apply
    if (report.isArchived()) return false;
    // Draft → only overrides apply
    if (report.isDraft()) return false;
    // Published audience rules
    switch (report.visibility) {
      case ReportVisibility.PUBLIC_ANON:
        return true;
      case ReportVisibility.PUBLIC_AUTH:
        return !!viewerId;
      case ReportVisibility.WITHIN_ORG_ONLY:
        return (
          !!viewerId &&
          (await this.orgs.isUserMember(viewerId, report.organizationId))
        );
      case ReportVisibility.WITHIN_ORG_ANCESTORS: {
        if (!viewerId) return false;
        if (await this.orgs.isUserMember(viewerId, report.organizationId))
          return true;
        const ancestors = await this.orgs.getAncestorIds(report.organizationId);
        for (const a of ancestors) {
          if (await this.orgs.isUserMember(viewerId, a)) return true;
        }
        return false;
      }
      case ReportVisibility.WITHIN_ORG_DESCENDANTS: {
        if (!viewerId) return false;
        if (await this.orgs.isUserMember(viewerId, report.organizationId))
          return true;
        const desc = await this.orgs.getDescendantIds(report.organizationId);
        for (const d of desc) {
          if (await this.orgs.isUserMember(viewerId, d)) return true;
        }
        return false;
      }
      case ReportVisibility.WITHIN_ORG_TREE: {
        if (!viewerId) return false;
        const tree = await this.orgs.getOrgTreeIds(report.organizationId);
        for (const o of tree) {
          if (await this.orgs.isUserMember(viewerId, o)) return true;
        }
        return false;
      }
      case ReportVisibility.WITHIN_BOARDS: {
        if (!viewerId) return false;
        for (const b of report.boardIds) {
          if (await this.boards.isUserMember(viewerId, b)) return true;
        }
        return false;
      }
      default:
        return false;
    }
  }
}
```

- [ ] **Step 3.2.4: Run; expect pass**

Run: `yarn test src/application/report/__tests__/ResolveReportVisibilityService.test.ts`
Expected: PASS, ~14 tests.

- [ ] **Step 3.2.5: Add `getAncestorIds`, `getDescendantIds`, `getOrgTreeIds` to `OrganizationRepository` if missing**

Open `src/domain/organization/OrganizationRepository.ts`. If these methods don't already exist, add them to the interface, and implement them in `PrismaOrganizationRepository` using recursive CTE queries against the existing `parent_id` column. Mirror the existing hierarchy traversal patterns in the file.

- [ ] **Step 3.2.6: Stage**

```bash
git add src/application/report/ResolveReportVisibilityService.ts src/application/report/__tests__/ResolveReportVisibilityService.test.ts src/domain/organization/OrganizationRepository.ts src/infrastructure/repositories/PrismaOrganizationRepository.ts
```

### Task 3.3 — `CreateReportUseCase`

**Files:**

- Create: `src/application/report/CreateReportUseCase.ts`
- Create: `src/application/report/__tests__/CreateReportUseCase.test.ts`

- [ ] **Step 3.3.1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CreateReportUseCase } from '../CreateReportUseCase';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { ReportDomainCodes } from '../../../domain/report/ReportDomainCodes';

class FakeReportRepo {
  saved: any[] = [];
  async create(r: any) {
    this.saved.push(r);
    r.props ??= {};
    return { success: true, value: r };
  }
}
class FakeOrgRepo {
  members = new Set<string>(); // userId:orgId
  async isUserMember(userId: string, orgId: string) {
    return this.members.has(`${userId}:${orgId}`);
  }
}
class FakeBoardRepo {
  byOrg = new Map<string, Set<string>>(); // orgId -> boardIds
  async findById(id: string) {
    return null;
  }
  async listForOrg(orgId: string): Promise<string[]> {
    return [...(this.byOrg.get(orgId) ?? [])];
  }
}

describe('CreateReportUseCase', () => {
  let repo: FakeReportRepo;
  let orgs: FakeOrgRepo;
  let boards: FakeBoardRepo;
  let uc: CreateReportUseCase;

  beforeEach(() => {
    repo = new FakeReportRepo();
    orgs = new FakeOrgRepo();
    boards = new FakeBoardRepo();
    uc = new CreateReportUseCase(repo as any, orgs as any, boards as any);
  });

  it('creates a Draft report for an org member', async () => {
    orgs.members.add('u1:org-1');
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-member', async () => {
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe(ReportErrors.NOT_ORG_MEMBER);
  });

  it('rejects WITHIN_BOARDS scope referencing a board from another org', async () => {
    orgs.members.add('u1:org-1');
    boards.byOrg.set('org-1', new Set(['b1']));
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'foreign-board'],
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error).toBe(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
  });
});
```

- [ ] **Step 3.3.2: Run; expect failure**

Run: `yarn test src/application/report/__tests__/CreateReportUseCase.test.ts`
Expected: FAIL.

- [ ] **Step 3.3.3: Implement**

```ts
import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from './StripMarkdownToPlainText';

export interface OrgRepoForCreateReport {
  isUserMember(userId: string, orgId: string): Promise<boolean>;
}

export interface BoardRepoForCreateReport {
  listForOrg(orgId: string): Promise<string[]>;
}

export interface CreateReportInput {
  userId: string;
  organizationId: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  boardIds: string[];
}

export class CreateReportUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForCreateReport,
    private boards: BoardRepoForCreateReport,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(input: CreateReportInput): Promise<Result<Report, string>> {
    const isMember = await this.orgs.isUserMember(
      input.userId,
      input.organizationId
    );
    if (!isMember) return failure(ReportErrors.NOT_ORG_MEMBER);

    if (input.visibility === ReportVisibility.WITHIN_BOARDS) {
      const orgBoardIds = new Set(
        await this.boards.listForOrg(input.organizationId)
      );
      for (const b of input.boardIds) {
        if (!orgBoardIds.has(b)) {
          return failure(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
        }
      }
    }

    const domainResult = Report.create({
      title: input.title,
      body: input.body,
      organizationId: input.organizationId,
      createdById: input.userId,
      visibility: input.visibility,
      boardIds: input.boardIds,
      profanityChecker: this.profanityChecker,
      stripMarkdownToPlainText,
    });
    if (!domainResult.success) return failure(domainResult.error);

    return await this.reports.create(domainResult.value);
  }
}
```

- [ ] **Step 3.3.4: Run; expect pass**

Run: `yarn test src/application/report/__tests__/CreateReportUseCase.test.ts`
Expected: PASS.

- [ ] **Step 3.3.5: Add `listForOrg` to `BoardRepository` interface if missing**

Open `src/domain/board/BoardRepository.ts`. Add:

```ts
listForOrg(organizationId: string): Promise<string[]>;
```

Implement in `src/infrastructure/repositories/PrismaBoardRepository.ts`:

```ts
async listForOrg(organizationId: string): Promise<string[]> {
  const rows = await this.prisma.board.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
```

- [ ] **Step 3.3.6: Stage**

```bash
git add src/application/report/CreateReportUseCase.ts src/application/report/__tests__/CreateReportUseCase.test.ts src/domain/board/BoardRepository.ts src/infrastructure/repositories/PrismaBoardRepository.ts
```

### Task 3.4 — `UpdateReportUseCase`

**Files:**

- Create: `src/application/report/UpdateReportUseCase.ts`
- Create: `src/application/report/__tests__/UpdateReportUseCase.test.ts`

- [ ] **Step 3.4.1: Write failing tests**

Cover: author or admin can edit Draft; non-author non-admin rejected with `NOT_AUTHOR_OR_ADMIN`; cannot edit Published; profanity in body rejected.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateReportUseCase } from '../UpdateReportUseCase';
import { Report } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { ReportDomainCodes } from '../../../domain/report/ReportDomainCodes';

const baseReport = () =>
  Report.reconstitute({
    id: 'r1',
    organizationId: 'org-1',
    createdById: 'author-1',
    title: 't',
    body: 'b',
    visibility: ReportVisibility.WITHIN_ORG_ONLY,
    state: 'DRAFT',
    publishedById: null,
    lastPublishedAt: null,
    notifyAudience: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    boardIds: [],
    pollIds: [],
    attachmentIds: [],
    videoLinkIds: [],
  });

class FakeReports {
  store = new Map<string, ReturnType<typeof baseReport>>();
  async findById(id: string) {
    const r = this.store.get(id);
    return { success: true, value: r ?? null };
  }
  updated: any[] = [];
  async update(r: any) {
    this.updated.push({ id: r.id, title: r.title, body: r.body });
    return { success: true, value: undefined };
  }
}
class FakeOrgs {
  admins = new Set<string>();
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.has(`${userId}:${orgId}`);
  }
}
class FakeUsers {
  superadmins = new Set<string>();
  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

describe('UpdateReportUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let uc: UpdateReportUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    uc = new UpdateReportUseCase(reports as any, orgs as any, users as any);
    reports.store.set('r1', baseReport());
  });

  it('author can update Draft title and body', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0]).toMatchObject({ title: 'New T', body: 'New B' });
  });

  it('org admin can update Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(true);
  });

  it('non-author non-admin rejected', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
  });

  it('cannot update Published report', async () => {
    const r = baseReport();
    r.publish('admin-1', false);
    reports.store.set('r1', r);
    const out = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      title: 'X',
      body: 'Y',
    });
    expect(out.success).toBe(false);
    if (!out.success)
      expect(out.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
  });
});
```

- [ ] **Step 3.4.2: Implement**

```ts
import { Result, success, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from './StripMarkdownToPlainText';

export interface OrgRepoForUpdate {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForUpdate {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface UpdateReportInput {
  reportId: string;
  callerId: string;
  title: string;
  body: string;
}

export class UpdateReportUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForUpdate,
    private users: UserRepoForUpdate,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(input: UpdateReportInput): Promise<Result<void, string>> {
    const lookup = await this.reports.findByIdWithRelations(input.reportId);
    if (!lookup.success) return failure(lookup.error);
    if (!lookup.value) return failure(ReportErrors.REPORT_NOT_FOUND);
    const report = lookup.value;

    const isAuthor = report.createdById === input.callerId;
    const isAdmin =
      !isAuthor &&
      (await this.orgs.isUserAdmin(input.callerId, report.organizationId));
    const isSuper =
      !isAuthor && !isAdmin && (await this.users.isSuperAdmin(input.callerId));
    if (!isAuthor && !isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }

    const titleResult = report.updateTitle(input.title, this.profanityChecker);
    if (!titleResult.success) return failure(titleResult.error);

    const bodyResult = report.updateBody(
      input.body,
      this.profanityChecker,
      stripMarkdownToPlainText
    );
    if (!bodyResult.success) return failure(bodyResult.error);

    return this.reports.update(report);
  }
}
```

- [ ] **Step 3.4.3: Run; expect pass**

Run: `yarn test src/application/report/__tests__/UpdateReportUseCase.test.ts`
Expected: PASS.

- [ ] **Step 3.4.4: Stage**

```bash
git add src/application/report/UpdateReportUseCase.ts src/application/report/__tests__/UpdateReportUseCase.test.ts
```

### Task 3.5 — Remaining edit use cases

Pattern: each accepts `(reportId, callerId, payload)`; checks author/admin perms; loads aggregate; mutates via aggregate method; calls `repo.update`. Each gets its own file + test.

Implement these in this order (each = its own commit):

- [ ] **Step 3.5.1: `SetReportVisibilityUseCase`**

Validates boards belong to report's org (reuses `BoardRepository.listForOrg`).

- [ ] **Step 3.5.2: `AttachPollUseCase`**

Loads poll; runs audience-superset rule via a helper `canPollSatisfyReportAudience(poll, report)`:

```ts
// In src/application/report/canPollSatisfyReportAudience.ts
import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export function canPollSatisfyReportAudience(
  poll: { organizationId: string; boardId: string | null },
  report: Report
): boolean {
  switch (report.visibility) {
    case ReportVisibility.PUBLIC_ANON:
    case ReportVisibility.PUBLIC_AUTH:
      return false;
    case ReportVisibility.WITHIN_ORG_ONLY:
      return (
        poll.organizationId === report.organizationId && poll.boardId === null
      );
    case ReportVisibility.WITHIN_ORG_ANCESTORS:
    case ReportVisibility.WITHIN_ORG_DESCENDANTS:
    case ReportVisibility.WITHIN_ORG_TREE:
      return false;
    case ReportVisibility.WITHIN_BOARDS:
      if (poll.organizationId !== report.organizationId) return false;
      if (poll.boardId === null) return true;
      return report.boardIds.includes(poll.boardId);
  }
}
```

Test all six branches.

Use-case rejects with `REPORT_POLL_AUDIENCE_TOO_NARROW` when false.

- [ ] **Step 3.5.3: `DetachPollUseCase`** — simple removal; no audience check needed.

- [ ] **Step 3.5.4: `AddReportAttachmentUseCase`**

Inputs: `reportId, callerId, fileName, mimeType, bytes`. Steps:

1. Load report; check perms (author/admin/superadmin).
2. Reject if not Draft.
3. Count existing attachments; reject if ≥ 20 (`REPORT_ATTACHMENT_LIMIT_REACHED`).
4. `ReportAttachment.createWithBytes(...)`.
5. `attachmentRepo.save(att, bytes)`.
6. `report.attachAttachment(savedId); reports.update(report)`.

- [ ] **Step 3.5.5: `RemoveReportAttachmentUseCase`**

Author/admin only, Draft only, calls `attachmentRepo.deleteById` then `report.detachAttachment`.

- [ ] **Step 3.5.6: `AddReportVideoLinkUseCase`**

Inputs: `reportId, callerId, url`. Validates url via `ReportVideoLink.create`. Checks count limit (10). Saves via `reports.addVideoLink`.

- [ ] **Step 3.5.7: `RemoveReportVideoLinkUseCase`** — author/admin only; Draft only.

Each task: write tests first, run failure, implement, run pass, stage.

### Task 3.6 — Publish / Downgrade / Archive use cases

- [ ] **Step 3.6.1: `PublishReportUseCase`**

Inputs: `reportId, callerId, notifyAudience`. Rules:

1. Load report (with relations).
2. Caller must be admin of `report.organizationId` (or superadmin).
3. `report.publish(callerId, notifyAudience)`.
4. `reports.update(report)`.
5. If `report.notifyAudience` is now `true`, dispatch `NotifyReportPublishedUseCase`.

Test all branches (admin OK, non-admin rejected, draft → published, notification suppressed for public-anon/public-auth).

- [ ] **Step 3.6.2: `DowngradeReportToDraftUseCase`**

Author or admin or superadmin. Domain method handles state.

- [ ] **Step 3.6.3: `ArchiveReportUseCase`**

Author or admin or superadmin. Domain method handles archiving.

### Task 3.7 — Read use cases

- [ ] **Step 3.7.1: `GetReportForViewerUseCase`**

Inputs: `reportId, viewerId | null`. Steps:

1. Load report with relations.
2. If null → return `REPORT_NOT_FOUND`.
3. `ResolveReportVisibilityService.canRead(report, viewerId)`. If false → return `REPORT_NOT_FOUND` (do NOT distinguish forbidden from missing — prevents existence-leak).
4. Return serialized report + related metadata (attachment list, poll list with archived flag, video links, boards).

- [ ] **Step 3.7.2: `ListReportsForViewerUseCase`**

Inputs: `viewerId | null, organizationIds[]?, page, pageSize`. Returns reports the viewer can read.

For anonymous viewers: only `visibility=PUBLIC_ANON`, `state=PUBLISHED`, not archived. Hint via repository search filters.

For logged-in viewers: union of:

- Public visibilities the viewer can see (both PUBLIC_AUTH and PUBLIC_ANON)
- Reports in orgs the viewer is a member of
- Reports in boards the viewer is a member of (within-boards)
- Drafts authored by viewer
- Drafts in orgs where viewer is admin
- Superadmin sees everything

Implementation: build the `where` clause using the user's known org/board memberships up front, then apply `organizationIds` filter on top if provided. Avoid in-memory filtering past the page boundary.

Pagination via `page * pageSize` skip. Order `lastPublishedAt DESC NULLS LAST, createdAt DESC`.

### Task 3.8 — `NotifyReportPublishedUseCase`

**Files:**

- Create: `src/application/report/NotifyReportPublishedUseCase.ts`

- [ ] **Step 3.8.1: Implement**

Fan out `Notification` rows (type `report_published`) to every eligible audience member based on report's visibility (WITHIN*ORG*\* / WITHIN_BOARDS only). Use existing `PrismaNotificationRepository.createMany`. Notification payload includes `reportId`, `title`, `organizationId`.

This use case is called from `PublishReportUseCase` only when `report.notifyAudience === true`. Must be idempotent (re-publish doesn't double-notify) — store no state; the caller controls the trigger.

### Task 3.9 — Phase 3 wrap

- [ ] Run full suite: `yarn test`
- [ ] Typecheck: `yarn typecheck`
- [ ] Mark `**Phase 3 complete.**` under the Phase 3 heading. Stop and let user review.

---

## Phase 4 — Web Actions and API Routes

### Task 4.1 — Server actions file

**Files:**

- Create: `src/web/actions/report/report.ts`

This file mirrors the structure of `src/web/actions/organization/propertyClaim.ts`. Each action:

1. `await checkRateLimit()`
2. `requireUser()` (extract the helper into a shared util if not already present)
3. Dispatch to use case
4. Map errors via `translateErrorCode`

- [ ] **Step 4.1.1: Compose the use cases and export the actions**

Skeleton:

```ts
'use server';

import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaPollRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { reportCreateLimiter } from '@/infrastructure/rateLimit/registry';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

import { CreateReportUseCase } from '@/application/report/CreateReportUseCase';
import { UpdateReportUseCase } from '@/application/report/UpdateReportUseCase';
import { SetReportVisibilityUseCase } from '@/application/report/SetReportVisibilityUseCase';
import { AttachPollUseCase } from '@/application/report/AttachPollUseCase';
import { DetachPollUseCase } from '@/application/report/DetachPollUseCase';
import { AddReportVideoLinkUseCase } from '@/application/report/AddReportVideoLinkUseCase';
import { RemoveReportVideoLinkUseCase } from '@/application/report/RemoveReportVideoLinkUseCase';
import { PublishReportUseCase } from '@/application/report/PublishReportUseCase';
import { DowngradeReportToDraftUseCase } from '@/application/report/DowngradeReportToDraftUseCase';
import { ArchiveReportUseCase } from '@/application/report/ArchiveReportUseCase';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { ListReportsForViewerUseCase } from '@/application/report/ListReportsForViewerUseCase';
import { NotifyReportPublishedUseCase } from '@/application/report/NotifyReportPublishedUseCase';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { ReportErrors } from '@/application/report/ReportErrors';
import { ReportVisibility } from '@/domain/report/ReportVisibility';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);
const notificationRepo = new PrismaNotificationRepository(prisma);
const profanity = LeoProfanityChecker.getInstance();

const visibilitySvc = new ResolveReportVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);
const notifyPublished = new NotifyReportPublishedUseCase({
  notificationRepository: notificationRepo,
  orgRepo,
  boardRepo,
  reportRepo,
});

const createUC = new CreateReportUseCase(
  reportRepo,
  orgRepo,
  boardRepo,
  profanity
);
const updateUC = new UpdateReportUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  profanity
);
const setVisUC = new SetReportVisibilityUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  boardRepo
);
const attachPollUC = new AttachPollUseCase(
  reportRepo,
  pollRepo,
  orgRepo,
  userRepo
);
const detachPollUC = new DetachPollUseCase(reportRepo, orgRepo, userRepo);
const addVideoUC = new AddReportVideoLinkUseCase(reportRepo, orgRepo, userRepo);
const removeVideoUC = new RemoveReportVideoLinkUseCase(
  reportRepo,
  orgRepo,
  userRepo
);
const publishUC = new PublishReportUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  notifyPublished
);
const downgradeUC = new DowngradeReportToDraftUseCase(
  reportRepo,
  orgRepo,
  userRepo
);
const archiveUC = new ArchiveReportUseCase(reportRepo, orgRepo, userRepo);
const getUC = new GetReportForViewerUseCase(
  reportRepo,
  visibilitySvc,
  attachmentRepo
);
const listUC = new ListReportsForViewerUseCase(reportRepo, orgRepo, userRepo);

async function requireUser(): Promise<{ error: string } | { userId: string }> {
  const u = await getCurrentUser();
  if (!u) {
    const t = await getTranslations('common.errors');
    return { error: t('unauthorized') as string };
  }
  return { userId: u.id };
}

export async function createReportAction(input: {
  organizationId: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  boardIds: string[];
}): Promise<ActionResult<{ reportId: string }>> {
  const rl = await checkRateLimit();
  if (rl) return rl;

  const auth = await requireUser();
  if ('error' in auth) return { success: false, error: auth.error };

  // Daily report-create limiter (10/day per user)
  if (!reportCreateLimiter.check(`user:${auth.userId}`).allowed) {
    return {
      success: false,
      error: await translateErrorCode(ReportErrors.RATE_LIMITED_DAILY),
    };
  }

  const r = await createUC.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
    title: input.title,
    body: input.body,
    visibility: input.visibility,
    boardIds: input.boardIds,
  });
  if (!r.success)
    return { success: false, error: await translateErrorCode(r.error) };
  return { success: true, data: { reportId: r.value.id } };
}

// ... similarly for updateReportAction, setReportVisibilityAction,
// attachPollAction, detachPollAction, addReportVideoLinkAction,
// removeReportVideoLinkAction, publishReportAction, downgradeReportAction,
// archiveReportAction, getReportAction, listReportsAction.
```

Each action follows the same skeleton: rate limit → auth → dispatch → translate error.

`getReportAction` accepts `viewerId | null`-style auth (anon allowed via direct page request, but server actions always require auth — so anon view goes through page render only, not actions). `listReportsAction` similarly is auth-required.

- [ ] **Step 4.1.2: Write each action** (one per step, smallest viable surface). Do **not** add input validation beyond `typeof` checks — domain layer handles bounds.

- [ ] **Step 4.1.3: Stage**

```bash
git add src/web/actions/report/report.ts
```

### Task 4.2 — Attachment upload API route

**Files:**

- Create: `src/app/api/report-attachments/route.ts`

- [ ] **Step 4.2.1: Implement POST**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AddReportAttachmentUseCase } from '@/application/report/AddReportAttachmentUseCase';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

const reports = new PrismaReportRepository(prisma);
const attachments = new PrismaReportAttachmentRepository(prisma);
const orgs = new PrismaOrganizationRepository(prisma);
const users = new PrismaUserRepository(prisma);
const uc = new AddReportAttachmentUseCase(reports, attachments, orgs, users);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await request.formData();
  const reportId = form.get('reportId');
  const file = form.get('file');
  if (
    typeof reportId !== 'string' ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await uc.execute({
    reportId,
    callerId: user.id,
    fileName: file.name,
    mimeType: file.type,
    bytes,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ id: result.value });
}
```

- [ ] **Step 4.2.2: Stage**

```bash
git add src/app/api/report-attachments/route.ts
```

### Task 4.3 — Attachment download / inline route

**Files:**

- Create: `src/app/api/report-attachments/[id]/route.ts`

- [ ] **Step 4.3.1: Implement GET with anon bypass for public-anon reports**

Adapt `src/app/api/property-claim-attachments/[id]/route.ts`:

1. Look up attachment by id (`attachmentRepo.findById`).
2. Look up parent report (`reportRepo.findById`).
3. Run `visibilitySvc.canRead(report, viewerIdOrNull)`. If false → 404 (existence-leak prevention).
4. Stream bytes:
   - For `image/*` set `Content-Disposition: inline`.
   - For `application/pdf` set `Content-Disposition: inline` so the click-from-card behavior opens in browser tab.
   - Always set `Content-Type` from stored mime.
   - Include `Cache-Control: private, no-store` for non-public reports; `Cache-Control: public, max-age=300` for public-anon published reports.

- [ ] **Step 4.3.2: Stage**

```bash
git add src/app/api/report-attachments/\[id\]/route.ts
```

### Task 4.4 — Phase 4 wrap

- [ ] Typecheck: `yarn typecheck`
- [ ] Mark `**Phase 4 complete.**`. Stop.

---

## Phase 5 — UI Components and Pages

### Task 5.1 — Install dependencies

- [ ] **Step 5.1.1: Add deps**

Run: `yarn add @uiw/react-md-editor react-markdown remark-gfm rehype-sanitize`
Expected: deps appear in `package.json`.

- [ ] **Step 5.1.2: Stage**

```bash
git add package.json yarn.lock
```

### Task 5.2 — `ReportMarkdownEditor` client component

**Files:**

- Create: `src/web/components/report/ReportMarkdownEditor.tsx`

- [ ] **Step 5.2.1: Implement**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamic import — editor is client-only and quite heavy
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((m) => m.default),
  { ssr: false }
);

interface Props {
  value: string;
  onChange: (next: string) => void;
  onUploadAttachment?: (
    file: File
  ) => Promise<{ id: string } | { error: string }>;
  maxLength?: number;
}

export function ReportMarkdownEditor({
  value,
  onChange,
  onUploadAttachment,
  maxLength,
}: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div data-color-mode={theme}>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={420}
        previewOptions={{ skipHtml: true }}
        textareaProps={{ maxLength }}
        onPaste={async (e) => {
          if (!onUploadAttachment) return;
          const file = e.clipboardData?.files?.[0];
          if (!file) return;
          e.preventDefault();
          const r = await onUploadAttachment(file);
          if ('id' in r)
            onChange(
              value + `\n\n![${file.name}](/api/report-attachments/${r.id})\n`
            );
        }}
        onDrop={async (e) => {
          if (!onUploadAttachment) return;
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;
          e.preventDefault();
          const r = await onUploadAttachment(file);
          if ('id' in r)
            onChange(
              value + `\n\n![${file.name}](/api/report-attachments/${r.id})\n`
            );
        }}
      />
    </div>
  );
}
```

### Task 5.3 — `ReportMarkdownRenderer`

**Files:**

- Create: `src/web/components/report/ReportMarkdownRenderer.tsx`

- [ ] **Step 5.3.1: Implement** with sanitization schema:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { detectVideoEmbed } from './detectVideoEmbed';
import { isAllowedAttachmentSrc } from './isAllowedAttachmentSrc';

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['https', 'mailto'],
    src: ['https', '/'],
  },
};

interface Props {
  source: string;
}

export function ReportMarkdownRenderer({ source }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
      skipHtml
      components={{
        a: ({ href, children, ...rest }) => {
          const v = href ? detectVideoEmbed(href) : null;
          if (v) {
            return (
              <iframe
                src={v.embedUrl}
                title={v.provider + ' video'}
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                className="aspect-video w-full rounded-md border border-zinc-200 dark:border-zinc-800"
                allow="encrypted-media; picture-in-picture; web-share"
              />
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
              {children}
            </a>
          );
        },
        img: ({ src, alt }) => {
          if (!src || typeof src !== 'string' || !isAllowedAttachmentSrc(src))
            return null;
          return (
            <img src={src} alt={alt ?? ''} className="max-w-full rounded" />
          );
        },
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 5.3.2: `detectVideoEmbed.ts`** — pure function that maps a URL to `{ provider, embedUrl }` or `null`. Same provider patterns as the value object; translates watch/short URLs into proper embed URLs.

- [ ] **Step 5.3.3: `isAllowedAttachmentSrc.ts`** — pure function: returns true iff `src.startsWith('/api/report-attachments/')`. Write tests for both helpers.

### Task 5.4 — Form pieces

- [ ] **Step 5.4.1: `VisibilityPicker`** — radio group of 7 options. Conditionally renders `<BoardsMultiPicker />` when `WITHIN_BOARDS` is selected. Localized labels and descriptions per the spec.

- [ ] **Step 5.4.2: `BoardsMultiPicker`** — accepts `orgBoards` (`{id, name}[]`); multi-select. Submits ids array.

- [ ] **Step 5.4.3: `PollPicker`** — accepts `attachablePolls` (server-pre-filtered by `canPollSatisfyReportAudience`); multi-select.

- [ ] **Step 5.4.4: `AttachmentUploader`** — file input + upload progress. POSTs to `/api/report-attachments`.

- [ ] **Step 5.4.5: `VideoLinkInput`** — text field; calls `ReportVideoLink.create` client-side too (import the value object; pure JS) for instant feedback. Server is the authority.

- [ ] **Step 5.4.6: `ReportForm`** — composes editor + visibility + boards + polls + attachments + video links. Two modes: create / edit.

- [ ] **Step 5.4.7: `ReportStateBadge`** — Draft / Published / Archived chip.

- [ ] **Step 5.4.8: `ReportCard`** — listing tile (title, author, org, lastPublishedAt, badge).

- [ ] **Step 5.4.9: `ReportDetail`** — header + body (rendered markdown) + attachments appendix + polls section + edit/publish buttons (admin/author conditional).

### Task 5.5 — Pages

- [ ] **Step 5.5.1: `[locale]/reports/new/page.tsx`** — Server component, fetches user + their member orgs; renders `<ReportForm mode="create" />`.

- [ ] **Step 5.5.2: `[locale]/reports/[id]/page.tsx`** — Fetches report via `getReportAction`. If success → render `<ReportDetail />`. If not → 404.

- [ ] **Step 5.5.3: `[locale]/reports/[id]/edit/page.tsx`** — Same but the form is in edit mode; requires `report.state === 'DRAFT'`.

- [ ] **Step 5.5.4: `[locale]/reports/page.tsx`** — Global feed via `listReportsAction`. Filters: org (multi). Sort fixed `publishedAt DESC`.

- [ ] **Step 5.5.5: `r/[id]/page.tsx`** — locale-agnostic. Reads `Accept-Language` header; falls back to `defaultLocale`. Uses `getReportAction` with `viewerId = null` for anon path (use a dedicated `getPublicReportAction` if needed, that doesn't require session).

- [ ] **Step 5.5.6: Add `ReportsSection` to `src/app/[locale]/organizations/[id]/page.tsx`**

Append after the Polls section:

```tsx
{
  (isUserMember ||
    isUserAdmin ||
    result.data.organization.visibility === 'PUBLIC_ANON') && (
    <ReportsSection organizationId={id} viewerId={user?.id ?? null} />
  );
}
```

Where `<ReportsSection />` is a server component that calls `listReportsAction({ organizationIds: [id], pageSize: 10 })` and renders a list of `ReportCard` + a "New report" button for org members.

### Task 5.6 — Phase 5 wrap

- [ ] Manually exercise the flow in dev: `yarn dev`, log in, create a report, upload an image, publish as admin, view in a second browser as a different user. Specifically verify:
  - Drafts visible only to author + admin.
  - PublicAnon report opens in incognito tab without login at `/r/[id]`.
  - Attachment URLs work for the audience.
- [ ] Typecheck + lint
- [ ] Mark `**Phase 5 complete.**`. Stop.

---

## Phase 6 — Localization

### Task 6.1 — `en.json` entries

**Files:**

- Modify: `messages/en.json`

- [ ] **Step 6.1.1: Add `domain.report.*` keys** (one per code in `ReportDomainCodes`).

Example block:

```json
"domain": {
  "report": {
    "titleEmpty": "Title cannot be empty",
    "titleTooLong": "Title cannot exceed {max} characters",
    "bodyEmpty": "Body cannot be empty",
    "bodyTooLong": "Body cannot exceed {max} characters",
    "invalidVisibility": "Invalid visibility",
    "boardsEmpty": "Select at least one board",
    "boardNotInOrg": "Board does not belong to the report's organization",
    "mustBeDraft": "Report must be a draft",
    "mustBePublished": "Report must be published",
    "cannotEditPublished": "Cannot edit a published report",
    "alreadyArchived": "Report is already archived",
    "archived": "Report is archived",
    "attachmentFilenameEmpty": "Attachment filename cannot be empty",
    "attachmentTooLarge": "Attachment is too large",
    "attachmentTypeNotAllowed": "Attachment type is not allowed",
    "attachmentMagicMismatch": "File contents do not match the declared type",
    "attachmentLimitReached": "Maximum {max} attachments per report",
    "videoUrlInvalid": "Video URL must be from YouTube, Vimeo, Rutube, or VK and use https",
    "videoLimitReached": "Maximum {max} video links per report",
    "videoNotFound": "Video link not found",
    "pollAudienceTooNarrow": "Poll audience is narrower than the report's audience",
    "pollNotFound": "Poll not found"
  }
}
```

(Per `userEmail` memory note: messages with limits/counts MUST be parameterized — already done above with `{max}`.)

- [ ] **Step 6.1.2: Add `report.*` UI namespace** — labels for visibility options, state badges, form fields, button labels, notification body, error messages, empty states.

- [ ] **Step 6.1.3: Stage**

### Task 6.2 — `ru.json` entries

Mirror every key. Russian translations for all of the above. The default UI is Russian per `defaultLocale`, so prioritize tone and conciseness.

### Task 6.3 — Phase 6 wrap

- [ ] Mark `**Phase 6 complete.**`. Stop.

---

## Phase 7 — SEO, sitemap, final polish

### Task 7.1 — Sitemap entry

**Files:**

- Create or modify: `src/app/sitemap.ts`

- [ ] **Step 7.1.1: Add public-anon reports**

```ts
import { MetadataRoute } from 'next';
import { prisma, PrismaReportRepository } from '@/infrastructure/index';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = new PrismaReportRepository(prisma);
  const r = await repo.listPublicAnonForSitemap();
  if (!r.success) return [];
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://resolutio.app';
  return r.value.map((entry) => ({
    url: `${origin}/r/${entry.id}`,
    lastModified: entry.lastPublishedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}
```

- [ ] **Step 7.1.2: Stage**

### Task 7.2 — OG meta tags

**Files:**

- Modify: `src/app/r/[id]/page.tsx`
- Modify: `src/app/[locale]/reports/[id]/page.tsx`

- [ ] **Step 7.2.1: Implement `generateMetadata`**

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getPublicReportForMetadata(id);
  if (!r) return { title: 'Report' };
  if (r.visibility !== 'PUBLIC_ANON') return { title: r.title };
  return {
    title: r.title,
    description: r.previewText,
    openGraph: {
      title: r.title,
      description: r.previewText,
      type: 'article',
      images: r.firstImageUrl ? [{ url: r.firstImageUrl }] : undefined,
      locale: r.locale,
      publishedTime: r.lastPublishedAt?.toISOString(),
    },
  };
}
```

Implementation of `getPublicReportForMetadata`: lightweight repo read (selecting `title`, `body`, `visibility`, `lastPublishedAt`, first attachment id where mime startsWith `image/`).

### Task 7.3 — Smoke test for state machine end-to-end

**Files:**

- Create: `src/application/report/__tests__/ReportFlow.integration.test.ts`

- [ ] **Step 7.3.1: Compose use cases against an in-memory `ReportRepository`/`OrgRepo`/`BoardRepo`/`UserRepo`** and verify:
  - User creates report → Draft.
  - Admin publishes → Published with `lastPublishedAt`.
  - Admin downgrades → Draft, `lastPublishedAt` preserved.
  - Admin re-publishes → Published, `lastPublishedAt` updated.
  - Archive → archived; cannot publish again.

### Task 7.4 — Final QA

- [ ] **Step 7.4.1: Typecheck + lint**

Run: `yarn typecheck && yarn lint`
Expected: pass.

- [ ] **Step 7.4.2: Full test suite**

Run: `yarn test`
Expected: pass.

- [ ] **Step 7.4.3: Manual UI walkthrough**

Start dev (`yarn dev`), test on desktop **and** mobile breakpoint:

1. Member creates a Draft with image and video URL.
2. Admin sees Draft in org page; admin sees and clicks Publish.
3. Admin checks "Notify audience"; verify notifications appear.
4. Open `/r/[id]` in incognito for a public-anon report; verify it renders and the image loads without auth.
5. Try setting visibility to `PUBLIC_AUTH`; verify anon viewer is redirected to login.
6. Attach a poll; verify subset rule rejects mismatched audiences.

- [ ] **Step 7.4.4: Mark `**Phase 7 complete.\*\*`. Stop.

---

## Self-review checklist

Run through after writing all phases:

- [ ] **Spec coverage**: every section of `readmes/2026-05-16-org-reports-design.md` mapped to a task. Author override, draft visibility, audience-superset rule, archive cascade, `lastPublishedAt` preservation across downgrade, public-anon attachment access, locale-agnostic anon route — all covered.
- [ ] **Type consistency**: `ReportVisibility` enum values match between domain, prisma enum, sanitization service, server actions, and UI.
- [ ] **Visibility check single source of truth**: `ResolveReportVisibilityService.canRead` is the only place that runs the audience math. Page rendering, the attachment route, and the read use cases all call it.
- [ ] **Rate limit**: `reportCreateLimiter` invoked at action top.
- [ ] **Profanity**: title and body (md-stripped) checked at domain layer.
- [ ] **No raw HTML rendering**: `skipHtml` set, sanitization schema applied, image src whitelist enforced.
- [ ] **Locale parity**: every key added to `messages/en.json` has a mirror in `messages/ru.json`.
- [ ] **Archive ≠ delete**: no `prisma.report.delete` calls anywhere except cascade-on-org-delete (which itself is an existing concern, not introduced here).
