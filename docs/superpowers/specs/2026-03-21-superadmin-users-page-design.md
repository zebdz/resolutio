# Superadmin Users Page — Design Spec

## Summary

Rebuild the superadmin users page (`/[locale]/superadmin/users`) from search-only to a full paginated list with search, filters, and existing block/unblock functionality.

## Requirements

- Show all users paginated (10 per page), traditional page-based navigation
- Display total user count matching current filters
- Search by name/nickname/phone (optional, no min char requirement)
- Filters:
  - `created_at`: date range (from/to)
  - `allow_find_by_name`: 3-state (All/Yes/No)
  - `allow_find_by_phone`: 3-state (All/Yes/No)
  - `block status`: 3-state (All/Blocked/Unblocked)
  - `organization`: searchable dropdown (combobox) — select an org to see only its members
- Each user item displays: full name, nickname, phone, created_at, allow_find_by_name, allow_find_by_phone, block status, # of orgs user is member of, # of polls user participated in
- Keep existing block/unblock and block history dialogs

## Approach

URL search params for all state (page, search, filters). Server page reads params, fetches data server-side, passes to client component. Shareable/bookmarkable URLs, back button works.

## Data Layer

### New server action: `listUsersForAdminAction`

**Location:** `src/web/actions/suspiciousActivity.ts`

**Input:**

```typescript
{
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;   // ISO date string
  dateTo?: string;     // ISO date string, treated as end-of-day (T23:59:59.999Z appended)
  allowFindByName?: 'yes' | 'no';
  allowFindByPhone?: 'yes' | 'no';
  blockStatus?: 'blocked' | 'unblocked';
  organizationId?: string;
}
```

**Output (serialized for client):**

```typescript
{
  users: SerializedAdminUserResult[];
  totalCount: number;
  totalPages: number;
}
```

**`SerializedAdminUserResult`** — plain object with Date fields as ISO strings:

```typescript
{
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string;
  nickname: string;
  createdAt: string;           // ISO string, not Date
  allowFindByName: boolean;
  allowFindByPhone: boolean;
  organizations: { id: string; name: string }[];  // orgs user is member of
  organizationCount: number;   // derived from organizations.length
  pollCount: number;           // # of polls user participated in
  blockStatus: {
    blocked: boolean;
    reason?: string;
    blockedAt?: string;        // ISO string, not Date
  } | null;
}
```

- Prisma query with dynamic WHERE clauses based on filters
- Search matches firstName, lastName, middleName, nickname, phoneNumber (case-insensitive)
- Block status filter: subquery on `user_block_statuses` to get latest status per user, filter by blocked/unblocked
- Organization filter: join through membership table to filter by org ID
- `organizationCount`: count of active memberships per user
- `pollCount`: count of votes/poll participations per user
- Block status: N+1 via `getBlockStatusForUser` per user — acceptable for 10 items per page (matches existing pattern)
- Ordered by `createdAt DESC`
- Existing `searchUsersForAdminAction` kept (other code may use it)
- Rate limit + superadmin auth check at top (standard pattern)

### New server action: `searchOrganizationsForFilterAction`

**Location:** `src/web/actions/suspiciousActivity.ts`

**Input:** `{ query: string }` (min 2 chars)

**Output:** `{ id: string; name: string }[]` (up to 20 results)

- Searches orgs by name (case-insensitive)
- Used by the org filter combobox
- Rate limit + superadmin auth check

### New server action: `getUserPollsAction`

**Location:** `src/web/actions/suspiciousActivity.ts`

**Input:** `{ userId: string }`

**Output:** `{ id: string; title: string; createdAt: string; organizationId: string; organizationName: string }[]`

- Returns polls the user voted in, with enough info to link to the poll results page
- Rate limit + superadmin auth check

## New Component: UserPollsDialog

**File:** `src/app/[locale]/superadmin/users/UserPollsDialog.tsx`

- Fetches polls on open via `getUserPollsAction`
- Lists polls with clickable links to poll results page (`prefetch={false}`)
- Loading state while fetching
- Empty state if user has no poll participation

## Server Page

**File:** `src/app/[locale]/superadmin/users/page.tsx`

**URL params:**

```
?page=1&search=john&dateFrom=2025-01-01&dateTo=2025-12-31&allowName=yes&allowPhone=no&blockStatus=blocked&orgId=clxyz123
```

- Validates/defaults: page defaults to 1, pageSize hardcoded to 10
- Calls `listUsersForAdminAction` server-side
- If `orgId` param present, also fetches org name for display in the combobox
- Passes serialized data + current filter values to client component
- No client-side fetch on mount — data comes from SSR

## Client Component: UserManagementPanel

**File:** `src/app/[locale]/superadmin/users/UserManagementPanel.tsx`

### Total Count

- Display total user count matching current filters (e.g. "Showing 142 users" or "{count} users found")

### Filter Bar (top)

- Search input (debounced 300ms, updates URL param)
- Date range: two date inputs (from/to)
- Two 3-state selects for allowFindByName and allowFindByPhone (All/Yes/No)
- 3-state select for block status (All/Blocked/Unblocked)
- Searchable org dropdown (combobox): calls `searchOrganizationsForFilterAction` on input, stores selected org ID in URL
- Changing any filter resets page to 1

### User Card

- Full name, nickname, phone
- Created at (formatted date)
- Allow find by name: yes/no indicator
- Allow find by phone: yes/no indicator
- Organization chips: one chip per org, clickable — links to org page. `prefetch={false}` required.
- Poll participation count
- Block status badge (active/blocked)
- Polls button: opens a dialog listing polls user participated in. Each poll is a clickable link to the poll results page.
- Block/Unblock button + History button (existing functionality)

### Pagination (bottom)

- Previous / Next buttons
- "Page {current} of {total}" indicator
- Total user count
- Disabled states on first/last page
- If `<Link>` elements used: `prefetch={false}` required (CLAUDE.md rule)

### URL Updates

- `useRouter().push()` with new params on filter/page change
- Next.js handles as client navigation (no full reload)

### Post-action Refresh

- After successful block/unblock, call `router.refresh()` to re-run the server page and get updated data
- `router.refresh()` preserves current URL params — filters, search, and page stay intact

## Unchanged Components

- `BlockUserDialog.tsx` — no changes
- `BlockHistoryDialog.tsx` — no changes

## New Components

- `UserPollsDialog.tsx` — dialog showing polls user participated in

## Localization

New keys needed under `superadmin.users`:

- Filter labels (dateFrom, dateTo, allowFindByName, allowFindByPhone, blockStatus, organization)
- 3-state select options (all, yes, no)
- Block status filter options (all, blocked, unblocked)
- Pagination: `pageOf: "Page {current} of {total}"` (parameterized per project convention)
- Total count: `totalUsers: "{count} users found"` (parameterized)
- Previous / Next button labels
- Created at label
- Privacy setting labels
- Organization count / poll count labels
- Org search placeholder
- Polls dialog: title, empty state, poll link labels
- Empty state when no users match filters

Added to both `messages/en.json` and `messages/ru.json`.

## Security

- Superadmin auth check on action
- Rate limit check on action
- All Date fields serialized to ISO strings before passing to client component
- No sensitive fields exposed (password, etc.)
- No domain objects cross the server/client boundary
