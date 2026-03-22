# Superadmin Log Viewer

## Overview

Browser-based log file viewer for superadmins. View, tail/follow, download, and archive server log files from the superadmin panel. Also browse and view archived log files.

All files read as UTF-8.

## File Discovery

Hardcoded known log sources, all paths relative to app root (`process.cwd()`):

```typescript
const LOG_SOURCES = [
  { id: 'deploy', path: 'deploy.log', label: 'Deploy Log' },
  { id: 'sms', path: 'logs/sms-ru.log', label: 'SMS Log', json: true },
  {
    id: 'sms-error',
    path: 'logs/sms-ru.error.log',
    label: 'SMS Errors',
    json: true,
  },
];
```

The `json` flag enables the prettify toggle in the UI and determines the timestamp parsing strategy for archive naming.

## API Routes

All under `/api/superadmin/logs/`. Every route checks superadmin auth via a dedicated API-route-compatible helper (not `requireSuperadmin()` from server actions — that relies on next-intl middleware context). The helper reads the session cookie directly and verifies superadmin status. No rate limiting — superadmin is whitelisted.

Unknown file IDs return 404. No user-supplied paths ever reach `fs` — IDs are resolved from `LOG_SOURCES` config only. Archive file names are validated against the `logs/archive/` directory.

Error response format (consistent with existing API routes):

```typescript
NextResponse.json({ error: string }, { status: 401 | 403 | 404 | 500 });
```

### `GET /api/superadmin/logs`

List available log files with metadata. Line counting uses streaming `\n` count (no full file load into memory). Also scans `logs/archive/` for archived zip files and includes them in the response, sorted descending (newest first). Archived files appear after live files in the dropdown.

Response:

```typescript
{
  files: Array<{
    id: string;
    label: string;
    exists: boolean;
    sizeBytes: number;
    totalLines: number;
    json: boolean;
    archived: boolean; // true for archived zip files
    archiveFilename?: string; // e.g. "deploy.log.2025-03-21_11:59_MSK-2025-03-22_15:42_MSK.zip"
  }>;
}
```

For archived files: `id` is the zip filename (without `.zip`), `totalLines` is counted from the extracted content, `json` is inferred from the original source ID prefix.

### `GET /api/superadmin/logs/[id]/read?mode=head|tail&offset=0`

Read a chunk of 50 lines (hardcoded chunk size, no `lines` parameter).

- `mode=head`: reads from top, `offset` = number of lines to skip from top
- `mode=tail`: reads from bottom, `offset` = number of lines to skip from bottom
- "Go to top" = `mode=head&offset=0`
- "Go to bottom" = `mode=tail&offset=0`

For archived files: extracts the log file from the zip into memory and reads from it.

Response:

```typescript
{
  lines: string[];
  startLine: number;   // 1-based
  endLine: number;
  totalLines: number;
  hasMore: boolean;
}
```

### `GET /api/superadmin/logs/[id]/download`

Streams the full file as a download (`Content-Disposition: attachment`).

For archived files: streams the zip file itself.

### `POST /api/superadmin/logs/[id]/archive`

Archives the log file:

1. Read first and last lines to extract timestamps
2. Create `logs/archive/` directory if it doesn't exist
3. Build archive filename: `{original-filename}.{first-timestamp}-{last-timestamp}.zip`
   - Timestamp format: `YYYY-MM-DD_HH:mm_MSK`
   - For `json: true` files: parse `timestamp_msk` from JSON
   - For `json: false` files: parse `[YYYY-MM-DD HH:MM:SS]` bracket format
   - Fallback: use current timestamp if parsing fails
4. Zip the file to `logs/archive/{archive-filename}`
5. Verify the zip exists and has size > 0
6. Only then truncate the original file to 0 bytes

Example archive names:

- `deploy.log.2025-03-21_11:59_MSK-2025-03-22_15:42_MSK.zip`
- `sms-ru.log.2025-03-10_08:00_MSK-2025-03-20_23:59_MSK.zip`

If zipping fails or verification fails, return error and leave original file untouched. The file path is not renamed — the app continues writing to the same path. Archive destination is always `logs/archive/` regardless of source file location (including `deploy.log` at app root).

### `GET /api/superadmin/logs/[id]/follow`

SSE endpoint. Tails the file using `fs.watch` + read from last known position. Sends new lines as they appear.

- Client pauses/resumes by closing/reopening the connection
- Heartbeat every 15s to detect stale connections
- Cleanup: `abort` listener on request signal to clean up file watcher on disconnect
- **Truncation detection:** if file size decreases (e.g. after archive), send `{ type: 'truncated' }` event so the client resets its view
- Max buffer: client caps accumulated lines at 500 during follow mode to prevent DOM bloat
- Not available for archived files (disabled in UI)

## UI

### Page

`src/app/[locale]/superadmin/logs/page.tsx` — server component, superadmin auth check, renders client panel.

Added to superadmin hub page (`hubLinks` array) with keys `logsLink` and `logsDescription`.

### Layout: Dropdown + Full Width

Single client component: `LogViewerPanel.tsx`

Top to bottom:

1. **Toolbar row:** file dropdown | Head/Tail toggle | Follow button (▶/⏸) | JSON Prettify toggle (visible only when file has `json: true`) | Download | Archive
2. **Log content area:** monospace, dark background, scrollable container, 50 lines per chunk
3. **Bottom bar:** ⬆ Top button | "Lines X-Y of Z" | ⬇ Bottom button | Load More button

### File Dropdown

Live files listed first, then a separator, then archived files sorted descending by filename (newest first). Archived files use the archive filename as label. Follow and Archive buttons are disabled when an archived file is selected.

### Behavior

**Head mode:** Shows first 50 lines. "Load More" appends next 50 below. ⬇ Bottom jumps to last 50 (switches to tail internally).

**Tail mode:** Shows last 50 lines. "Load More" prepends 50 lines above. ⬆ Top jumps to first 50 (switches to head internally).

**Follow mode:** Activates SSE. New lines append at bottom, auto-scrolls. Pause stops auto-scroll but keeps connection. Resume resumes auto-scroll. Switching file or clicking Top/Head stops follow. Client caps DOM at 500 lines (oldest lines dropped). Not available for archived files.

**JSON Prettify:** Client-side toggle. Parses each line as JSON and pretty-prints. Only available when file has `json: true`. Lines that fail JSON parsing are shown as-is (raw text).

**Archive:** Confirmation dialog before executing. Shows file name and size. Disabled for non-existent files and archived files.

## Security

- **Auth:** Every API route uses a dedicated API-route-compatible superadmin auth helper (reads session cookie directly, verifies superadmin role). Not the server-action `requireSuperadmin()`.
- **Path traversal:** File IDs resolved from hardcoded config only. Archive filenames validated to exist within `logs/archive/`. No user-supplied paths reach `fs`.
- **File not found:** List endpoint reports `exists: false`. Read/download/follow return error. Archive disabled in UI.
- **SSE cleanup:** Abort listener + heartbeat for stale connection detection. Truncation detection sends reset event.
- **Archive safety:** Zip → verify → truncate. Failure at any step leaves original untouched.

## Localization

New keys under `superadmin.logs`:

- Hub link: `logsLink`, `logsDescription`
- Page title
- File labels
- Button labels: head, tail, follow, pause, resume, download, archive, prettify, loadMore, top, bottom
- Status: "Lines {start}-{end} of {total}" (parameterized), "Following...", "Paused", "Empty file"
- Archive confirmation: title, message (parameterized with filename + size), confirm, cancel
- Errors: fileNotFound, archiveFailed, readFailed, connectionError
- Archive section: archiveSeparator ("Archived")
