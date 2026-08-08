# Poll Description Media — Design

Date: 2026-08-08
Status: Approved, not yet implemented

## Goal

Let a poll author write a long description (up to 10 000 characters) and embed
**images** and **PDFs** inline within it, so that the argument put to voters can
carry its own evidence.

This mirrors what organization reports already do. The bulk of the work is
generalizing the report markdown/attachment machinery to a second aggregate,
not building something new.

## Decisions

| Question               | Decision                                                                | Rationale                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description max length | 1 000 → **10 000**                                                      | Already applied. `polls.description` is Postgres `TEXT`, unbounded — no migration needed. 50 000 was considered and rejected; see "Why 10 000, not 50 000". |
| Media types            | **image + PDF only**                                                    | Audio and video dropped. Matches the existing `ReportAttachment` whitelist exactly.                                                                         |
| Storage                | **Postgres `bytea`**, as `PollAttachment.bytes`                         | See "Why not disk" below.                                                                                                                                   |
| Placement              | **Inline**, referenced from the description text                        | Author places evidence at the point of the argument that needs it.                                                                                          |
| Markup                 | **Markdown**, same renderer as reports                                  | Already built, already hardened.                                                                                                                            |
| PDF rendering          | **Downloadable link**, not an embedded viewer                           | Images render inline; PDFs render as a link that opens in a new tab.                                                                                        |
| Mutability             | Frozen once the poll is ACTIVE                                          | Mirrors the existing `Poll.updateDescription` guard.                                                                                                        |
| Create flow            | Unchanged; a modal offers a just-in-time DRAFT save on first attachment | Avoids taxing authors who never attach media.                                                                                                               |
| Count cap              | **20 per poll**                                                         | Same as reports.                                                                                                                                            |

### Why not disk

Storing files on disk with paths in the DB was considered and rejected. The
deployment is a single VPS behind nginx (no containers, no horizontal scaling),
so disk _would_ have worked — the usual ephemerality objection does not apply
here. It was rejected on other grounds:

- **Backups are asymmetric.** `deploy-on-server.sh` backs up only
  `.next/ generated/ package.json`. Files on disk would form a second durability
  domain that nothing currently protects. Poll media is potentially court
  evidence.
- **Deploys would eventually eat them.** Deployment is `tar -xzf` extracted over
  the live directory; an `uploads/` dir there survives only because tar does not
  delete unlisted files — survival by accident, not design.
- **nginx serves statics directly.** The vhost has a
  `location ~* ^.+\.(jpg|jpeg|gif|png|...)$` block serving from `$root_path`,
  bypassing Next entirely. Any upload landing under the web root would be
  publicly downloadable by URL with no permission check. Organization polls are
  private; this would be a real leak.
- **Atomicity.** Row plus bytes commit in one transaction — no orphaned files,
  no dangling paths, no reconciliation job.
- **The archive-not-delete rule holds naturally.** A DB row obeys it by default;
  disk files make it an operational promise nothing enforces.

Postgres TOAST stores `bytea` values over ~2 KB out of line and compressed, so
this does not affect row scans on `polls`. Two precedents already exist with
this exact shape: `ReportAttachment` and `PropertyClaimAttachment`.

The `serverActions.bodySizeLimit: '12mb'` ceiling does not apply: uploads go
through a route handler, as `api/report-attachments/route.ts` already does.

## Data model

New model, cloned from `ReportAttachment`:

```prisma
model PollAttachment {
  id        String   @id @default(cuid())
  pollId    String   @map("poll_id")
  fileName  String   @map("file_name")
  mimeType  String   @map("mime_type")
  sizeBytes Int      @map("size_bytes")
  bytes     Bytes
  createdAt DateTime @default(now()) @map("created_at")

  poll Poll @relation(fields: [pollId], references: [id], onDelete: Cascade)

  @@index([pollId])
  @@map("poll_attachments")
}
```

`Poll` gains an `attachments PollAttachment[]` relation, and the `Poll`
aggregate gains an `attachmentIds: string[]` prop mirroring `Report`.

Migration is additive — a new table only. Run `yarn prisma:generate` after
`prisma migrate dev` (the migrate step does not regenerate the client in this
repo).

## Domain layer

**`src/domain/poll/PollAttachment.ts`** — cloned from `ReportAttachment.ts`,
with the whitelist narrowed:

```ts
export const POLL_ATTACHMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const POLL_ATTACHMENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const POLL_ATTACHMENT_COUNT_LIMIT = 20;

export const POLL_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;
```

Magic-byte validation carries over unchanged — the declared MIME type is never
trusted. Office/ODF formats are deliberately excluded; polls take evidence, not
documents.

**`Poll.updateDescription`** (`src/domain/poll/Poll.ts:280`) gains an attachment
ref check, mirroring `Report.updateBody`:

- The description may only reference attachments belonging to _this_ poll.
- The existing `isFinished() || isActive()` guard already freezes the
  description once voting opens; attachments inherit it. Adding or removing an
  attachment on an ACTIVE poll must fail with the same code.

**Shared helper.** `validateBodyAttachmentRefs` currently lives as a private
function in `Report.ts:408`. Lift it to
`src/domain/shared/attachments/validateAttachmentRefs.ts`, parameterized by API
path prefix, and have both aggregates call it.

New domain codes (add to `PollDomainCodes.ts` and to `messages/en.json` +
`messages/ru.json`):

- `domain.poll.attachmentLimitReached`
- `domain.poll.descriptionInvalidAttachmentRef`
- `domain.poll.attachmentTypeNotAllowed`
- `domain.poll.attachmentTooLarge`

Size-limit messages must be parameterized (`{maxMb}`), never hardcoded numbers.

UI strings for the draft-save modal (title, explanation, Save, Cancel) also go
into both message files — nothing user-facing is hardcoded.

## Application layer

- `AddPollAttachmentUseCase` — clone of `AddReportAttachmentUseCase`: authorize
  caller, fail fast if the poll is not editable, enforce the count cap, validate
  bytes, persist.
- `RemovePollAttachmentUseCase` — clone of the report equivalent.
- `ResolvePollAttachmentVisibilityService` — **new, no direct clone exists.**
  Reports have `ResolveReportVisibilityService`; polls do not have an equivalent
  abstraction. Read access must mirror how the poll itself is read:
  - `OPEN` polls — readable without a session (matches
    `GetOpenPollPreviewUseCase`, used by the public preview page).
  - `ORGANIZATION` polls — restricted to members of the owning organization,
    and to the board when `boardId` is set.

  This service is the only genuinely new application-layer concept in the
  feature and deserves its own focused tests.

Authorization for _writing_ follows the existing poll-edit rules (author, org
admin, or superadmin) — reuse whatever `EditPollForm`'s server action already
enforces rather than inventing a parallel check.

## Interface layer

### Routes

- `POST /api/poll-attachments` — clone of `api/report-attachments/route.ts`.
  Multipart, `pollId` + `file`, delegates to the use case.
- `GET /api/poll-attachments/[id]` — clone of
  `api/report-attachments/[id]/route.ts`. Metadata first, then the visibility
  check, then bytes. Forbidden and missing both collapse to 404 so attachment
  existence cannot be probed. `Cache-Control: public, max-age=300` for OPEN
  polls, `private, no-store` otherwise.

### Shared component generalization

Three report components hardcode the report API prefix. Parameterize them and
move them to `src/web/components/markdown/`:

| File                            | Hardcoding                                               |
| ------------------------------- | -------------------------------------------------------- |
| `ReportMarkdownEditor.tsx:50`   | `` `![${file.name}](/api/report-attachments/${r.id})` `` |
| `ReportMarkdownRenderer.tsx:32` | `ATTACHMENT_ID_FROM_SRC` regex                           |
| `isAllowedAttachmentSrc.ts`     | `src.startsWith('/api/report-attachments/')`             |

Both call sites then pass their own prefix. Report behavior must not change.

### Two fixes to the shared components

**1. PDF refs must use link syntax.** `ReportMarkdownEditor.tsx:50` inserts
image syntax unconditionally, so an uploaded PDF becomes
`<img src="....pdf">` — a broken image. This is a live bug in reports today.
Branch on the uploaded file's type:

```ts
const url = `${apiPrefix}/${r.id}`;
const ref =
  file.type === 'application/pdf'
    ? `\n\n[${file.name}](${url})\n`
    : `\n\n![${file.name}](${url})\n`;
```

The renderer's existing `a` handler already opens links in a new tab with
`rel="noreferrer noopener"`, and the serve route sets
`Content-Disposition: inline`, so a PDF link opens in the browser's viewer.
Fixed for reports and polls together.

**2. Add `remark-breaks`.** Markdown collapses single newlines, so pasted text
with per-line clauses renders as one run-on paragraph. This is the most likely
point of confusion for authors who do not know markdown, and legal text —
numbered clauses, addresses, enumerations — is exactly the shape that triggers
it. Adding `remark-breaks` to the shared renderer makes single newlines behave
as the author expects. Applies to reports too, which have the same problem
today.

Other markdown surprises were assessed and judged acceptable: `1.` and `-` at
line start become lists (renders better than the raw text), `#` is low-risk in
Russian text which uses `№`, and GFM already protects intra-word underscores.
The editor's live preview pane lets authors see all of this as they type.

### Editor placement

`CreatePollForm.tsx:707` and `EditPollForm.tsx:875` replace their
`<Textarea rows={3}>` with the markdown editor, passing
`maxLength={POLL_DESCRIPTION_MAX_LENGTH}`. Both forms upload through
`POST /api/poll-attachments` via the editor's `onUploadAttachment` callback,
which already handles paste and drag-drop.

**Ordering problem — resolved via just-in-time draft save.** On the create form
there is no poll id yet, so an attachment cannot be linked at paste time.

Restructuring the create flow into a mandatory two-step wizard was considered
and rejected: it taxes every author to serve only those who attach media.

**Decision: leave the create flow exactly as it is.** When the author attempts
their first attachment (paste, drop, or the upload button) and no poll id exists
yet, show a modal — "the poll must be saved as a draft before files can be
attached" — with **Save** and **Cancel**. Save persists the DRAFT and the upload
then proceeds against the new id. Cancel aborts the upload and leaves the form
untouched.

Why this is better: authors who never attach media see no change at all;
abandoned DRAFTs only arise from a deliberate Save, not as a side effect of
opening the form; and the id is obtained exactly when it is first needed.

Three details for implementation:

- **The draft save must validate.** `Poll.create` (`Poll.ts:52-72`) requires a
  non-empty title, a non-empty description, and `startDate < endDate`. If any is
  missing when the modal's Save is pressed, surface the same field errors the
  normal submit would and keep the modal open. In practice this rarely bites:
  the title is the first field, dates are pre-filled
  (`CreatePollForm.tsx:133` defaults the end date to +30 days), and authors
  normally write some text before adding evidence. The awkward case is pasting
  an image into a still-empty description as the very first action — the modal
  then has to say the description cannot be empty, which is a slightly odd thing
  to be told while writing it.

  If that friction proves real in use, the cleaner fix is to relax the
  description-required invariant for DRAFT polls and enforce it on the
  DRAFT → READY transition instead, since a draft is incomplete by definition.
  That is a wider domain change and is deliberately not being made now.

- **The form must switch to update mode after the save.** Once the DRAFT exists,
  subsequent submits must update that poll, not create a second one. Hold the
  new id in form state and route the submit accordingly; `router.replace` to the
  edit route is the simplest way to make this unambiguous and survive a reload.

- **Cancel must leave no trace.** The editor's `insertAttachment` only writes a
  ref after a successful upload, so aborting inserts nothing. No cleanup needed.

## Rendering changes

The description is currently rendered as plain text in four places. All become
the markdown renderer, with the poll's own attachment ids passed as the
allowlist:

| Site                                  | Current                          | Change                                                                                       |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `polls/[pollId]/vote/page.tsx:160`    | bare `<p>`                       | markdown renderer                                                                            |
| `polls/[pollId]/results/page.tsx:222` | bare `<p>`                       | markdown renderer                                                                            |
| `PublicOpenPollPreview.tsx:47`        | `<Text className="text-center">` | markdown renderer, drop `text-center`                                                        |
| `PollCard.tsx:252`                    | `line-clamp-2`                   | **strip markdown to plain text first** — otherwise the card shows literal `![photo](/api/…)` |

The results PDF export also assumes plain text and needs the same stripping
helper — `poll.description` is embedded at `results/pdf/route.ts:144` and
`results/named-pdf/route.ts:146`. (`protocol-pdf/route.ts` does not use the
description and needs no change. There is no poll OG image today — the only
`opengraph-image.tsx` in the app belongs to org join tokens — so nothing to do
there.)

A single `stripMarkdown(source: string): string` helper in
`src/web/lib/` serves both the card preview and the PDF exports.

## Security

- Files never touch the filesystem, so nginx's static-serving block cannot
  expose them. The auth-checked route is the only way in.
- The renderer resolves image refs **only** against attachment ids belonging to
  this poll (`allowedAttachmentIds`). A hand-typed ref to another poll's private
  attachment renders as a blocked-image placeholder, not an `<img>`.
- The domain guard rejects cross-poll refs at save time; the renderer allowlist
  is defense in depth for anything already stored.
- `skipHtml` plus `rehype-sanitize` — no raw HTML is ever parsed. Protocols
  limited to `https`, `mailto`, and relative `/`.
- Declared MIME types are never trusted; magic bytes decide.
- Serialization: attachment metadata crossing to Client Components must be
  plain objects. Never send `bytes` to the client — only ids and metadata.

## Testing

Unit tests first, per project convention.

- `PollAttachment` — accepts each allowed type by magic bytes; rejects a
  mismatched declared MIME; rejects oversize per type.
- `Poll.updateDescription` — accepts refs to own attachments; rejects refs to
  foreign ids; rejects at 10 001 characters; still rejects when ACTIVE.
- `Poll.addAttachment` / `removeAttachment` — enforce the 20 cap; reject once
  ACTIVE.
- `AddPollAttachmentUseCase` — authorization, count cap, state guard.
- `ResolvePollAttachmentVisibilityService` — OPEN readable anonymously;
  ORGANIZATION restricted to members; board-scoped polls restricted to the
  board.
- `stripMarkdown` — images and links reduce to their alt/label text.
- Create-form draft modal — attempting an attachment with no poll id opens the
  modal; Save with a missing required field keeps it open and shows the field
  error; Save with valid fields creates exactly one DRAFT and the upload then
  succeeds; a second submit updates that poll rather than creating another;
  Cancel inserts no ref and creates no poll.
- Shared renderer — foreign attachment id renders the placeholder, not an
  `<img>`; `remark-breaks` turns a single newline into a line break.

## Out of scope

- Audio and video uploads.
- Range-request support on the serve route (was only needed for audio).
- Transcoding, thumbnailing, image resizing.
- Migrating existing report attachments anywhere.
- Embedded PDF viewers — PDFs are links.

`detectVideoEmbed` (YouTube/VK links → sandboxed iframe) comes along for free
in the shared renderer and stays enabled for polls. This is link embedding, not
file upload, so it is unaffected by the decision to drop video files.

## Why 10 000, not 50 000

50 000 was considered — the database is indifferent, since `TEXT` is unbounded —
and rejected because of what the description feeds into downstream. 10 000 is
judged sufficient for a poll description and keeps all three effects small.

**1. AI legality check token cost — the deciding factor.**
`legalAnalysisPrompt.ts:49` interpolates the entire description into the LLM
prompt, against a platform-wide daily cap of `100_000` tokens
(`AnalyzePollLegalityUseCase.ts:20`). Russian tokenizes at roughly 2–3
characters per token:

| Description length | Tokens per check | Share of daily cap |
| ------------------ | ---------------- | ------------------ |
| 10 000 chars       | ~4 000           | ~4%                |
| 50 000 chars       | ~20 000          | ~20%               |

At 50 000 a handful of long polls would exhaust the platform's daily AI budget
for everyone. At 10 000 the cost is proportionate.

**Decision: no truncation for now.** The full description continues to flow into
the prompt. At ~4% per check this is affordable, and truncating would cost
legality-check fidelity for no present benefit. Revisit if the daily cap starts
being hit in practice — truncation before the prompt is the fix, and
`legal_check_daily_token_cap` is a configurable setting if more headroom is
wanted instead.

**2. List payload.** `PollCard` receives `poll.description` and renders two
clamped lines of it. At 10 000 characters, a list of 20 polls carries roughly
400 KB of Cyrillic UTF-8 to render 40 lines of text. Not urgent, but truncating
server-side in the list query or its serialization is cheap and worth doing
while the card is being changed for markdown stripping anyway — the card never
needs more than a couple of hundred characters.

**3. Client-side markdown parsing.** The renderer is a Client Component, so
parsing up to 10 KB of markdown happens in the browser. Memoize on `source`, and
prefer rendering server-side where the page is already a Server Component.

Attachment refs also consume the budget — roughly 65 characters each, so 20
attachments cost about 1 300 characters, or 13% of the 10 000. Worth surfacing
in the editor's character counter, which counts raw markdown source.
