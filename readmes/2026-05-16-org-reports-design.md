# Organization Reports — Design

## Goal

Let any organization member author a Markdown report tied to their organization. Reports may attach polls (many-to-many), embed images / PDFs / video URLs, and choose an audience: public-anon, public-auth, within-org (with four hierarchy modes), or within-board(s).

## User stories

- As an org member, I can draft a Markdown report with images, PDFs, and video URLs.
- As an org member, I can attach any number of polls to my report (subject to the audience-superset rule).
- As an org admin, I review submitted drafts and publish them.
- As an org admin or the author, I can downgrade a published report to Draft to edit; only an admin can republish.
- As a reader, I see reports I have access to under the relevant organization, in the global `/reports` feed, or via a direct link.
- As an anonymous visitor, I can read `public-anon` reports without logging in.

## Entities

### `Report` (aggregate root, new bounded context)

| Field             | Type                     | Notes                                                        |
| ----------------- | ------------------------ | ------------------------------------------------------------ |
| `id`              | `cuid`                   | PK                                                           |
| `organizationId`  | `string`                 | Home org. FK → `organizations`                               |
| `createdById`     | `string`                 | Author. FK → `users`                                         |
| `title`           | `string ≤ 200`           | Profanity-checked                                            |
| `body`            | `string ≤ 50_000`        | Markdown source. Profanity-checked after markdown→text strip |
| `visibility`      | `ReportVisibility` enum  | See below                                                    |
| `state`           | `'DRAFT' \| 'PUBLISHED'` | Lifecycle                                                    |
| `publishedById`   | `string?`                | Admin who last published; null in Draft                      |
| `lastPublishedAt` | `DateTime?`              | Set on first publish; preserved across downgrades            |
| `notifyAudience`  | `Boolean`                | Captured at publish time; resets to `false` on downgrade     |
| `createdAt`       | `DateTime`               |                                                              |
| `updatedAt`       | `DateTime`               |                                                              |
| `archivedAt`      | `DateTime?`              | Archive only; never deleted                                  |

Within-board(s) scope is modeled as a separate join table `report_boards` (composite PK `(report_id, board_id)`).

### `ReportAttachment`

Mirrors `PropertyClaimAttachment` (inline `bytea`, magic-byte verified, mime whitelist, size cap).

| Field       | Type       | Notes                            |
| ----------- | ---------- | -------------------------------- |
| `id`        | `cuid`     | PK                               |
| `reportId`  | `string`   | FK → `reports` ON DELETE CASCADE |
| `fileName`  | `string`   | Original filename, trimmed       |
| `mimeType`  | `string`   | One of allowed types             |
| `sizeBytes` | `int`      | ≤ per-type cap                   |
| `bytes`     | `bytea`    | Raw bytes                        |
| `createdAt` | `DateTime` |                                  |

Allowed mime types and caps:

| Mime type         | Cap   |
| ----------------- | ----- |
| `image/png`       | 5 MB  |
| `image/jpeg`      | 5 MB  |
| `image/webp`      | 5 MB  |
| `application/pdf` | 10 MB |

Per-report cap: **20 attachments**.

### Video URLs (no entity)

Video URLs live **inline in the markdown body** — no separate table, no domain entity, no count cap. The renderer auto-detects URLs from a whitelist of providers and replaces them with embedded `<iframe>` players; non-matching URLs render as plain `<a>` links (still subject to the protocol whitelist).

Provider detection regexes (used by the renderer only):

| Provider  | Pattern (https only)                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `youtube` | `^https://(www\.)?(youtube\.com/(watch\?v=\|embed/\|shorts/)\|youtu\.be/)[\w-]{6,}` |
| `vimeo`   | `^https://(www\.)?vimeo\.com/\d+`                                                   |
| `rutube`  | `^https://rutube\.ru/video/\w{6,}`                                                  |
| `vk`      | `^https://(www\.)?vk\.com/(video[-\d_]+\|video\?z=video[-\d_]+)`                    |

### `ReportPoll` (join)

| Field        | Type                 | Notes          |
| ------------ | -------------------- | -------------- |
| `reportId`   | `string`             | FK → `reports` |
| `pollId`     | `string`             | FK → `polls`   |
| Composite PK | `(reportId, pollId)` |                |

Attached polls survive `Poll.archive` — the row is not deleted; the UI shows an "archived" badge.

### `ReportBoard` (join, only used when `visibility = 'WITHIN_BOARDS'`)

| Field        | Type                  | Notes                                                                                          |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| `reportId`   | `string`              | FK → `reports`                                                                                 |
| `boardId`    | `string`              | FK → `boards` (board MUST belong to report's `organizationId` — enforced in application layer) |
| Composite PK | `(reportId, boardId)` |                                                                                                |

## Visibility (`ReportVisibility` enum)

| Value                    | Reader rule                                                |
| ------------------------ | ---------------------------------------------------------- |
| `PUBLIC_ANON`            | Anyone (no auth required)                                  |
| `PUBLIC_AUTH`            | Any authenticated user                                     |
| `WITHIN_ORG_ONLY`        | `OrganizationUser` of `organizationId` (status=`accepted`) |
| `WITHIN_ORG_ANCESTORS`   | Member of `organizationId` OR any ancestor org             |
| `WITHIN_ORG_DESCENDANTS` | Member of `organizationId` OR any descendant org           |
| `WITHIN_ORG_TREE`        | Member of any org in the same connected hierarchy          |
| `WITHIN_BOARDS`          | Member of ≥ 1 listed board (UNION)                         |

Overrides applied **before** the rule above:

1. **Author always reads own report**, regardless of visibility and state.
2. **Admins of `organizationId` always read** the report (in any state, including Draft — see "Draft visibility" below).
3. **Superadmins always read** (cross-org).

Draft visibility (additional restriction): when `state = 'DRAFT'`, the only readers are author + admins of `organizationId` + superadmins. Audience rules apply only when `state = 'PUBLISHED'`.

## State machine

```
[create] ─┐
          ▼
        DRAFT  ──(admin publishes)─►  PUBLISHED
          ▲                              │
          └──(author or admin)───────────┘
                downgrade
```

Both states may be archived; archive is terminal (un-archive is out of scope for v1).

| Transition                                                | Caller                          | Side effects                                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create                                                    | Any org member                  | Report begins in `DRAFT`, `publishedById = null`                                                                                                                                                       |
| Update title/body                                         | Author or admin in `DRAFT` only | `updatedAt` bumps                                                                                                                                                                                      |
| Update visibility / boards / polls / attachments / videos | Author or admin in `DRAFT` only | Same                                                                                                                                                                                                   |
| Publish                                                   | Admin of `organizationId` only  | `state = 'PUBLISHED'`, `publishedById = caller`, `lastPublishedAt = now`. Optional `notifyAudience` checkbox: if true AND visibility is `WITHIN_ORG_*` or `WITHIN_BOARDS`, fan out `Notification` rows |
| Downgrade to Draft                                        | Author or admin                 | `state = 'DRAFT'`. `publishedById = null`. `lastPublishedAt` **preserved**. `notifyAudience` reset to `false`. No reader-facing notification on downgrade                                              |
| Archive                                                   | Author or admin                 | `archivedAt = now`. Archived reports are excluded from feeds and direct routes (404 to non-author/non-admin)                                                                                           |

Notification suppression: `notifyAudience` is force-suppressed when visibility is `PUBLIC_ANON` or `PUBLIC_AUTH` (the audience is too broad / has no inbox for anon).

## Audience-superset rule for attached polls

A poll `P` may be attached to a report `R` iff every reader of `R` is also a reader of `P`. Concretely:

| Report visibility        | Allowed polls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ANON`            | None today (polls have no public flag)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_AUTH`            | None today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `WITHIN_ORG_ONLY`        | `P.organizationId == R.organizationId` AND `P.boardId IS NULL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `WITHIN_ORG_ANCESTORS`   | `P.organizationId == R.organizationId` AND `P.boardId IS NULL` (ancestor members are wider than the poll audience? — yes; ancestors aren't org members of `R.organizationId`; **stricter:** only `R.organizationId` polls and require that ancestors also be `OrganizationUser` of `P.organizationId`. Practically: poll audience must cover ancestors-or-broader → only org-only polls within the same org cannot satisfy the rule. **In v1 we disallow poll attach for ancestor/descendant/tree visibilities to keep the rule simple.** Author gets a clear "no eligible polls" message.) |
| `WITHIN_ORG_DESCENDANTS` | Same as above — disallowed in v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `WITHIN_ORG_TREE`        | Same as above — disallowed in v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `WITHIN_BOARDS`          | `P.organizationId == R.organizationId` AND (`P.boardId IS NULL` OR `P.boardId IN R.boardIds`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

The picker on the report form shows only attachable polls. Changing visibility to a tighter mode after attaching may render some attachments illegal — re-validation on save.

## Authorship constraints

- **Create**: any `OrganizationUser` with `status = 'accepted'` for `organizationId`.
- **Edit (in Draft)**: author OR org admin OR superadmin.
- **Publish**: org admin OR superadmin only.
- **Downgrade**: author OR org admin OR superadmin.
- **Archive**: author OR org admin OR superadmin.

For `WITHIN_BOARDS` visibility, the listed boards must all belong to `R.organizationId`. The author may list **any** boards from that org, even ones they are not a member of (author-can-read override compensates).

## Markdown rendering and sanitization

- **Editor**: `@uiw/react-md-editor` (dynamic import, client-only).
- **Renderer**: `react-markdown` + `remark-gfm` + `rehype-sanitize` (custom schema).
- **Sanitization schema**:
  - Raw HTML: **disabled** (`skipHtml`).
  - URL protocols allowed: `https`, `mailto`.
  - Image references resolved via `/api/report-attachments/{id}` URLs only (renderer ignores external image URLs in v1; we don't want hot-link leaks or arbitrary image fetches). Authors paste images by uploading; the editor inserts the well-formed reference.
  - Embedded videos rendered by a custom `remark`/`rehype` plugin that detects raw `https://www.youtube.com/...`, `vimeo.com`, `rutube.ru`, `vk.com` URLs on a line by themselves and replaces them with `<iframe>` embeds (lazy-loaded, sandboxed).
- **PDF references**: rendered as a card-link (filename + size) that opens in a new tab to `/api/report-attachments/{id}`.

## Attachment access route

`/api/report-attachments/[id]` (Next.js Route Handler):

1. Look up attachment metadata.
2. Look up the parent report.
3. Resolve viewer (session may be absent for `PUBLIC_ANON`).
4. Run `ResolveReportVisibilityService.canRead(report, viewer)`.
   - If `report.visibility = 'PUBLIC_ANON'` AND `report.state = 'PUBLISHED'` AND `!report.archivedAt` → allow with no auth.
   - Otherwise require auth + audience match.
5. Stream bytes with `Content-Type = mimeType`, `Content-Disposition: inline` for images, `attachment` for PDFs (or `inline` if author prefers — PDFs we use `inline` because they're embedded as card-links opening in new tab).

Upload route `POST /api/report-attachments` (multipart):

- Auth required.
- Caller must be the report's author OR an admin of its org (matches edit perms).
- Report must be in `DRAFT`.
- Magic-byte verification + size cap + per-report count cap enforced before write.

## Rate limits

| Action            | Limit                                  | Scope       |
| ----------------- | -------------------------------------- | ----------- |
| Create report     | 10/day                                 | per user    |
| All other actions | existing `serverActionSessionLimiter`  | per session |
| Attachment upload | existing limiter (no separate counter) | per session |

A new limiter `reportCreateLimiter` is added in `src/infrastructure/rateLimit/registry.ts` with a 24-hour window.

## Discovery surfaces

### 1. Org detail page

Add a "Reports" section beneath the existing "Recent polls" section in `src/app/[locale]/organizations/[id]/page.tsx`. Lists reports the viewer can see for that org, ordered `publishedAt DESC`. Drafts appear if viewer is author or admin.

### 2. Global feed `/[locale]/reports`

Authenticated users only. Aggregates reports the viewer can read across all orgs the user belongs to PLUS `public-auth` reports across the platform. Filters: by organization (multi-select dropdown). Sort: `publishedAt DESC`.

### 3. Per-report URL

Two routes serve the same content:

- `/[locale]/reports/[id]` — i18n-prefixed; used by all internal links to keep locale state consistent for authenticated users.
- `/r/[id]` — **locale-agnostic**; used as the canonical share URL for `public-anon` reports. Locale resolution for anonymous viewers: `Accept-Language` header → fallback to `defaultLocale` (Russian per `src/i18n/locales.ts`).

Both routes use the same `ResolveReportVisibilityService.canRead` check and the same React rendering tree.

### 4. Sitemap

`src/app/sitemap.ts` enumerates `public-anon` reports (state=PUBLISHED, not archived). The sitemap returns `/r/[id]` URLs with `lastmod = lastPublishedAt`.

### 5. OG meta tags

On `/r/[id]` (and `/[locale]/reports/[id]` when visibility is `public-anon`):

- `og:title` = report title
- `og:description` = first 160 chars of markdown body, stripped to plain text
- `og:type` = `article`
- `og:image` = first inlined image attachment if present (resolved to absolute URL of `/api/report-attachments/{id}`)
- `og:locale` = report's resolved locale
- `article:published_time` = `lastPublishedAt`

For non-public visibility, return generic meta (title only) to avoid leaking content.

## Validation summary

| Field                 | Rule                                                                      | Code                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `title`               | non-empty, ≤ 200 chars, no profanity                                      | `REPORT_TITLE_EMPTY`, `REPORT_TITLE_TOO_LONG`, `CONTAINS_PROFANITY`                                                             |
| `body`                | non-empty, ≤ 50,000 chars, no profanity (after md→text strip)             | `REPORT_BODY_EMPTY`, `REPORT_BODY_TOO_LONG`, `CONTAINS_PROFANITY`                                                               |
| `visibility`          | enum value                                                                | `REPORT_INVALID_VISIBILITY`                                                                                                     |
| `boards`              | non-empty when `visibility=WITHIN_BOARDS`; all belong to `organizationId` | `REPORT_BOARDS_EMPTY`, `REPORT_BOARD_NOT_IN_ORG`                                                                                |
| Attachment file       | mime in whitelist; size ≤ cap; magic bytes match                          | `REPORT_ATTACHMENT_TYPE_NOT_ALLOWED`, `REPORT_ATTACHMENT_TOO_LARGE`, `REPORT_ATTACHMENT_MAGIC_MISMATCH`                         |
| Attachment count      | ≤ 20 per report                                                           | `REPORT_ATTACHMENT_LIMIT_REACHED`                                                                                               |
| Attached poll         | audience-superset rule                                                    | `REPORT_POLL_AUDIENCE_TOO_NARROW`                                                                                               |
| State transition      | per state machine                                                         | `REPORT_MUST_BE_DRAFT`, `REPORT_MUST_BE_PUBLISHED`, `REPORT_NOT_AUTHOR_OR_ADMIN`, `REPORT_NOT_ADMIN`, `REPORT_ALREADY_ARCHIVED` |
| Edit while published  | rejected                                                                  | `REPORT_CANNOT_EDIT_PUBLISHED`                                                                                                  |
| Author org membership | `OrganizationUser.status = 'accepted'` for `organizationId`               | `NOT_ORG_MEMBER` (reuse existing)                                                                                               |

## Localization

All UI strings live under `report.*` namespaces in `messages/en.json` and `messages/ru.json`. Error codes are dotted `domain.report.*` and translated by the existing `translateErrorCode` helper.

Reports themselves are **not language-tagged** — any author writes in any language; consumers translate manually if needed.

## Security checklist

- Domain entities never cross the Server→Client boundary. All RSC responses serialize to plain objects.
- Visibility check is performed **server-side** on every read path (page, action, route handler). Client never decides who can see what.
- Attachment download verifies parent-report visibility before streaming bytes.
- Markdown renderer disables raw HTML and restricts URL protocols.
- Image embeds restricted to `/api/report-attachments/{id}` URLs (no external image fetches).
- Video embeds run in `sandbox="allow-scripts allow-same-origin allow-presentation"` iframes with `referrerpolicy="no-referrer"`.
- Rate limit on create. Magic-byte verification on upload.

## File layout

### Domain (`src/domain/report/`)

- `Report.ts` — aggregate root
- `ReportVisibility.ts` — enum + helpers
- `ReportAttachment.ts` — entity (mirrors `PropertyClaimAttachment`)
- `ReportRepository.ts` — interface
- `ReportAttachmentRepository.ts` — interface
- `ReportDomainCodes.ts` — error codes

### Application (`src/application/report/`)

- `CreateReportUseCase.ts`
- `UpdateReportUseCase.ts` — title/body in Draft
- `SetReportVisibilityUseCase.ts` — visibility + boards in Draft
- `AttachPollUseCase.ts` / `DetachPollUseCase.ts`
- `AddReportAttachmentUseCase.ts` / `RemoveReportAttachmentUseCase.ts`
- `PublishReportUseCase.ts`
- `DowngradeReportToDraftUseCase.ts`
- `ArchiveReportUseCase.ts`
- `GetReportForViewerUseCase.ts`
- `ListReportsForViewerUseCase.ts`
- `NotifyReportPublishedUseCase.ts`
- `ResolveReportVisibilityService.ts` — `canRead(report, viewer)` and `canRead` precondition for poll attach
- `ReportErrors.ts`
- `StripMarkdownToPlainText.ts` — utility used by profanity check

### Infrastructure (`src/infrastructure/repositories/`)

- `PrismaReportRepository.ts`
- `PrismaReportAttachmentRepository.ts`
- Wire-up in `src/infrastructure/index.ts`
- New limiter in `src/infrastructure/rateLimit/registry.ts`

### Web (`src/web/`)

- `actions/report/report.ts` — server actions
- Components under `src/web/components/report/`:
  - `ReportMarkdownEditor.tsx`
  - `ReportMarkdownRenderer.tsx`
  - `VisibilityPicker.tsx`
  - `BoardsMultiPicker.tsx`
  - `PollPicker.tsx`
  - `AttachmentUploader.tsx`
  - `ReportForm.tsx`
  - `ReportCard.tsx`
  - `ReportDetail.tsx`
  - `ReportArchivedPollBadge.tsx`

### Pages (`src/app/`)

- `[locale]/reports/page.tsx` — global feed
- `[locale]/reports/new/page.tsx` — create
- `[locale]/reports/[id]/page.tsx` — detail (with edit if author/admin)
- `[locale]/reports/[id]/edit/page.tsx` — edit form
- `r/[id]/page.tsx` — locale-agnostic anon route
- `api/report-attachments/route.ts` — upload (POST)
- `api/report-attachments/[id]/route.ts` — download/inline (GET)
- `sitemap.ts` — public-anon entries

## Out of scope (v1)

- Versioning / revision history (downgrade hides the report; once republished it overwrites).
- Comments / reactions.
- Cross-org board scoping.
- Language tagging on reports.
- Polls' own visibility flag (so reports with `public-*` or `WITHIN_ORG_ANCESTORS/DESCENDANTS/TREE` visibility cannot currently attach polls).
- Unarchive.
- In-browser PDF rendering / first-page thumbnails.
- Search across reports (only listing + per-org filter for v1).

## Unresolved questions

None at design time.
