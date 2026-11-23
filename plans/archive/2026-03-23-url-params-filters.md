# URL Params Filters Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all filter UIs from local state to URL search params, matching the pattern in `superadmin/users/UserManagementPanel.tsx`.

**Architecture:** Each page's server component reads `searchParams`, validates/parses them, calls the server action with those filters, and passes results + filter values to the client component. The client component uses `buildUrl()` + `router.push()` to navigate on filter changes instead of local state + `useEffect` fetching. This makes filters shareable and persistent across page refreshes.

**Tech Stack:** Next.js 15 (App Router), `useRouter`/`usePathname` from `next/navigation`, `URLSearchParams`.

---

## Reference Pattern

File: `src/app/[locale]/superadmin/users/UserManagementPanel.tsx:103-154`

```
Server component (page.tsx):
  1. Accept searchParams as Promise<{...}>
  2. Parse/validate each param
  3. Call server action with parsed filters
  4. Pass data + filters (as plain strings) to client component

Client component:
  1. Receive filters as props (NOT local state for filter values)
  2. buildUrl(updates) — merges updates into current filters, builds URLSearchParams string
  3. navigateWithFilter(updates) — calls router.push(buildUrl({...updates, page: 1}))
  4. Debounced text search — local state for input value only, navigateWithFilter in timeout
  5. Clear filters — router.push(pathname)
  6. Pagination — router.push(buildUrl({ page: N }))
```

**Key rule:** The server component is the source of truth for filter state. The client component only holds local state for the search input value (for debounce). All other filters read from props passed by the server.

---

## File Map

### Task 1 — Suspicious Activity

- Modify: `src/app/[locale]/superadmin/suspicious-activity/page.tsx`
- Modify: `src/app/[locale]/superadmin/suspicious-activity/SuspiciousActivityPanel.tsx`

### Task 2 — Polls List (shared component, 2 consumers)

- Create: `src/web/components/polls/PollsListUrl.tsx` — URL-param-driven wrapper
- Rename: `src/web/components/polls/PollsList.tsx` → `PollsListLocal.tsx` — local-state-driven (existing logic)
- Create: `src/web/components/polls/PollsListView.tsx` — shared presentational component (filter bar + grid + pagination UI)
- Modify: `src/app/[locale]/polls/page.tsx`
- Modify: `src/app/[locale]/organizations/[id]/page.tsx` (import path change only)

### Task 3 — Organizations List (shared component, 2 consumers)

- Modify: `src/app/[locale]/organizations/OrganizationsList.tsx`
- Modify: `src/app/[locale]/organizations/page.tsx`
- Modify: `src/app/[locale]/superadmin/organizations/page.tsx`
- Modify: `src/app/[locale]/superadmin/organizations/SuperadminOrganizationsList.tsx`

### Task 4 — Pending Requests

- Modify: `src/app/[locale]/organizations/[id]/pending-requests/page.tsx`
- Modify: `src/app/[locale]/organizations/[id]/pending-requests/OrgPendingRequestsList.tsx`

### All Tasks — Translations

- Modify: `messages/en.json` — add any missing pagination/filter keys
- Modify: `messages/ru.json` — same

### Note on commits

Commits are marked in the plan for logical boundaries. The user commits themselves (per project rules).

---

## Task 1: Suspicious Activity — URL Params Filters

**Complexity:** Medium — 5 filter fields, "load more" infinite-scroll pagination, block/unblock dialogs stay as-is.

**Filters:** `search`, `dateFrom`, `dateTo`, `minBlocked`, `maxBlocked`, `page`

**Note:** This page uses "load more" (infinite scroll-style). After migration, switch to standard pagination (prev/next) since URL params need a discrete page value. The `loadMore` append pattern doesn't map cleanly to URL params — you'd need to encode "show all pages up to N" which is wasteful on re-render. Standard pagination is simpler and consistent with the reference pattern.

### Files:

- Modify: `src/app/[locale]/superadmin/suspicious-activity/page.tsx`
- Modify: `src/app/[locale]/superadmin/suspicious-activity/SuspiciousActivityPanel.tsx`

### Steps:

- [ ] **Step 1: Update `page.tsx` to accept and parse searchParams**

Add `searchParams` to props. Parse: `page` (int, default 1), `search` (string), `dateFrom` (string), `dateTo` (string), `minBlocked` (int), `maxBlocked` (int). Call `getSuspiciousActivitySummaryAction` with parsed filters. Pass `items`, `totalCount`, `totalPages`, `currentPage`, and `filters` object to `SuspiciousActivityPanel`.

```tsx
// page.tsx
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { SuspiciousActivityPanel } from './SuspiciousActivityPanel';
import { getSuspiciousActivitySummaryAction } from '@/src/web/actions/superadmin/suspiciousActivity';

const PAGE_SIZE = 20;

interface SuspiciousActivityPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    minBlocked?: string;
    maxBlocked?: string;
  }>;
}

export default async function SuspiciousActivityPage({
  searchParams,
}: SuspiciousActivityPageProps) {
  const t = await getTranslations('superadmin.suspiciousActivity');
  const tHub = await getTranslations('superadmin.hub');
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const minBlocked = params.minBlocked
    ? parseInt(params.minBlocked, 10) || undefined
    : undefined;
  const maxBlocked = params.maxBlocked
    ? parseInt(params.maxBlocked, 10) || undefined
    : undefined;

  const result = await getSuspiciousActivitySummaryAction({
    page,
    pageSize: PAGE_SIZE,
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    minBlocked,
    maxBlocked,
  });

  const data = result.success ? result.data : { items: [], totalCount: 0 };

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/superadmin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; {tHub('back')}
        </Link>
        <Heading level={2} className="text-xl font-semibold">
          {t('title')}
        </Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </Text>
      </div>

      <SuspiciousActivityPanel
        items={data.items}
        totalCount={data.totalCount}
        totalPages={totalPages}
        currentPage={page}
        filters={{
          search: params.search ?? '',
          dateFrom: params.dateFrom ?? '',
          dateTo: params.dateTo ?? '',
          minBlocked: params.minBlocked ?? '',
          maxBlocked: params.maxBlocked ?? '',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Refactor `SuspiciousActivityPanel.tsx` to use URL params**

Remove all local filter state (`search`, `dateFrom`, `dateTo`, `minBlocked`, `maxBlocked`), the `useEffect` that re-fetches on filter change, `pageRef`, and `handleLoadMore`.

Add props: `items`, `totalCount`, `totalPages`, `currentPage`, `filters`.

Add `buildUrl`/`navigateWithFilter` pattern (same as UserManagementPanel). Add debounced search input (local state for the input value only). Replace "Load More" button with prev/next pagination. Keep dialog logic (block/unblock/blockIp) exactly as-is, but after a successful action call `router.refresh()` instead of `fetchSummary()`.

Key changes to the component signature:

```tsx
interface SuspiciousActivityFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  minBlocked: string;
  maxBlocked: string;
}

interface SuspiciousActivityPanelProps {
  items: SuspiciousKeySummary[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters: SuspiciousActivityFilters;
}

export function SuspiciousActivityPanel({
  items,
  totalCount,
  totalPages,
  currentPage,
  filters,
}: SuspiciousActivityPanelProps) {
  const t = useTranslations('superadmin.suspiciousActivity');
  const tLabels = useTranslations('superadmin.rateLimits.labels');
  const router = useRouter();
  const pathname = usePathname();

  // Local state ONLY for search debounce + dialogs
  const [searchValue, setSearchValue] = useState(filters.search);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // ... keep expandedKey, events, blockTarget, unblockTarget, blockIpTarget,
  //     isLoading, error, dialogError state as-is

  const buildUrl = useCallback(
    (updates: Partial<SuspiciousActivityFilters> & { page?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...updates };
      if (merged.search) params.set('search', merged.search);
      if (merged.dateFrom) params.set('dateFrom', merged.dateFrom);
      if (merged.dateTo) params.set('dateTo', merged.dateTo);
      if (merged.minBlocked) params.set('minBlocked', merged.minBlocked);
      if (merged.maxBlocked) params.set('maxBlocked', merged.maxBlocked);
      const page = updates.page ?? 1;
      if (page > 1) params.set('page', String(page));
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pathname]
  );

  const navigateWithFilter = useCallback(
    (updates: Partial<SuspiciousActivityFilters>) => {
      router.push(buildUrl({ ...updates, page: 1 }));
    },
    [buildUrl, router]
  );

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  // Debounced number inputs (minBlocked, maxBlocked)
  // Use same pattern — local state for the input, debounced navigateWithFilter
  const [minBlockedValue, setMinBlockedValue] = useState(filters.minBlocked);
  const [maxBlockedValue, setMaxBlockedValue] = useState(filters.maxBlocked);
  // ... (same debounce timer pattern as search for each)
```

For block/unblock/blockIp success handlers, replace `await fetchSummary(1, {...})` with `router.refresh()`.

Add "Clear filters" button (visible when any filter is active):

```tsx
{
  (filters.search ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.minBlocked ||
    filters.maxBlocked) && (
    <Button
      plain
      onClick={() => {
        setSearchValue('');
        router.push(pathname);
      }}
      className="text-sm"
    >
      {t('clearFilters')}
    </Button>
  );
}
```

Replace the "Load More" button with prev/next pagination:

```tsx
{
  totalPages >= 1 && (
    <div className="flex items-center justify-between">
      <Button
        plain
        disabled={currentPage <= 1}
        onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
      >
        {t('previous')}
      </Button>
      <Text className="text-sm text-zinc-500">
        {t('pageOf', { current: currentPage, total: totalPages })}
      </Text>
      <Button
        plain
        disabled={currentPage >= totalPages}
        onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
      >
        {t('next')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Add missing translation keys if needed**

For pagination, reuse `common.pagination` keys (`previous`, `next`, `page`). For `clearFilters`, add to `superadmin.suspiciousActivity` namespace (or reuse from `superadmin.users` if available). Check both `messages/en.json` and `messages/ru.json`.

Note: `handleExpandKey` (calls `getSuspiciousActivityForKeyAction` directly) is not filter-related — no changes needed there.

- [ ] **Step 4: Test in browser**

Navigate to `/superadmin/suspicious-activity`. Verify:

1. Filters appear in URL when changed
2. Refreshing page preserves filters
3. Back/forward browser navigation works
4. Clear filters button resets URL
5. Pagination works (prev/next)
6. Block/unblock user actions still work (dialogs, refresh after success)
7. Block IP action still works
8. Expandable row detail still works

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/superadmin/suspicious-activity/
git commit -m "refactor: suspicious activity filters to URL params"
```

---

## Task 2: Polls List — URL Params Filters

**Complexity:** High — 8 filter fields + pageSize, shared component used in 2 pages (`/polls` and `/organizations/[id]`), board dropdown depends on selected org.

**Filters:** `search`, `status`, `orgId`, `boardId`, `createdFrom`, `createdTo`, `startFrom`, `startTo`, `page`, `pageSize`

**Design decision:** `PollsList` is used in two contexts:

1. `/polls` page — standalone, all filters visible, URL params needed
2. `/organizations/[id]` page — embedded with `fixedOrganizationId`, no org dropdown, local state is fine

To avoid a fragile dual-mode component with `if (useUrlFilters)` branches everywhere, split into separate components:

- `PollsListView` — pure presentational (filter bar UI, poll grid, pagination). Receives values + callbacks.
- `PollsListUrl` — URL-param-driven controller. Uses `buildUrl`/`navigateWithFilter`. Renders `PollsListView`.
- `PollsListLocal` — renamed from current `PollsList`. Local state controller. Renders `PollsListView`.

**`createdFrom` default behavior:** When no filters are set, the server defaults `createdFrom` to one week ago. "Reset filters" navigates to bare pathname; server re-applies the default. This means the createdFrom input shows the one-week-ago value after reset. This is intentional — "reset" means "back to defaults", not "show everything".

### Files:

- Create: `src/web/components/polls/PollsListView.tsx` — shared presentational component
- Create: `src/web/components/polls/PollsListUrl.tsx` — URL-param controller
- Rename+modify: `src/web/components/polls/PollsList.tsx` → keep as-is but extract view into `PollsListView`
- Modify: `src/app/[locale]/polls/page.tsx` — use `PollsListUrl`
- Modify: `src/app/[locale]/organizations/[id]/page.tsx` — update import to `PollsList` (local, unchanged behavior)

### Steps:

- [ ] **Step 1: Extract `PollsListView` — shared presentational component**

Create `src/web/components/polls/PollsListView.tsx`. This is the filter bar + poll grid + pagination UI. It receives all values and callbacks as props — it has no state of its own.

```tsx
// PollsListView.tsx
interface PollsListViewProps {
  // Data
  polls: any[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  isPending: boolean;

  // Filter values
  searchValue: string;
  status: string;
  organizationId: string;
  boardId: string;
  createdFrom: string;
  createdTo: string;
  startFrom: string;
  startTo: string;

  // Filter options
  organizations?: Array<{ id: string; name: string }>;
  boards: Array<{ id: string; name: string }>;
  fixedOrganizationId?: string;

  // User context
  userId: string;
  adminOrgIds: string[];
  isSuperAdmin: boolean;

  // Callbacks
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onBoardChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onStartFromChange: (value: string) => void;
  onStartToChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
  onPollStateChange: () => void;
}
```

Move all JSX from current `PollsList` (filter bar, grid, pagination) into `PollsListView`. Each input binds to `value` + `onChange` callback from props. No `useEffect`, no `useState`, no `useRouter` — just rendering.

- [ ] **Step 2: Refactor existing `PollsList` to use `PollsListView`**

Current `PollsList` keeps all its local state logic (`useState`, `useEffect`, `fetchPolls`, etc.) but delegates rendering to `<PollsListView ... />`. This is a pure refactor — behavior doesn't change.

- [ ] **Step 3: Update `/polls/page.tsx` to accept searchParams**

```tsx
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

interface PollsPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    orgId?: string;
    boardId?: string;
    createdFrom?: string;
    createdTo?: string;
    startFrom?: string;
    startTo?: string;
  }>;
}

export default async function PollsPage({ searchParams }: PollsPageProps) {
  // ... existing user/org setup stays the same ...

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 10;

  // Default createdFrom to one week ago when no filters at all
  const hasAnyFilter = params.search || params.status || params.orgId ||
    params.boardId || params.createdFrom || params.createdTo ||
    params.startFrom || params.startTo;
  const defaultCreatedFrom = hasAnyFilter ? undefined : oneWeekAgo.toISOString().split('T')[0];

  const pollsResult = await searchPollsAction({
    titleSearch: params.search || undefined,
    statuses: params.status ? [params.status as PollState] : undefined,
    organizationId: params.orgId || undefined,
    boardId: params.boardId === '__org_wide__' ? undefined : params.boardId || undefined,
    orgWideOnly: params.boardId === '__org_wide__' || undefined,
    createdFrom: params.createdFrom || defaultCreatedFrom,
    createdTo: params.createdTo || undefined,
    startFrom: params.startFrom || undefined,
    startTo: params.startTo || undefined,
    page,
    pageSize,
  });

  // Fetch initial boards if orgId is set
  let initialBoards: Array<{ id: string; name: string }> = [];
  if (params.orgId) {
    const boardsResult = await getBoardsByOrganizationAction(params.orgId);
    if (boardsResult.success) initialBoards = boardsResult.data;
  }

  // Use PollsListUrl instead of PollsList
  <PollsListUrl
    polls={polls}
    totalCount={totalCount}
    organizations={organizations}
    userId={user.id}
    adminOrgIds={adminOrgIds}
    isSuperAdmin={isSuperAdmin}
    initialBoards={initialBoards}
    filters={{
      search: params.search ?? '',
      status: params.status ?? '',
      orgId: params.orgId ?? '',
      boardId: params.boardId ?? '',
      createdFrom: params.createdFrom ?? defaultCreatedFrom ?? '',
      createdTo: params.createdTo ?? '',
      startFrom: params.startFrom ?? '',
      startTo: params.startTo ?? '',
    }}
    currentPage={page}
    pageSize={pageSize}
    totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
  />
```

Add `import { getBoardsByOrganizationAction } from '@/src/web/actions/board/board'` and `import { PollState } from '@/domain/poll/PollState'` to the page.

- [ ] **Step 4: Create `PollsListUrl` — URL-param controller**

Create `src/web/components/polls/PollsListUrl.tsx`. This is a thin wrapper with `buildUrl`/`navigateWithFilter` that renders `PollsListView`.

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PollsListView } from './PollsListView';

const DEFAULT_PAGE_SIZE = 10;

interface PollFilters {
  search: string;
  status: string;
  orgId: string;
  boardId: string;
  createdFrom: string;
  createdTo: string;
  startFrom: string;
  startTo: string;
}

interface PollsListUrlProps {
  polls: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  filters: PollFilters;
  organizations?: Array<{ id: string; name: string }>;
  initialBoards: Array<{ id: string; name: string }>;
  userId: string;
  adminOrgIds: string[];
  isSuperAdmin: boolean;
}

export function PollsListUrl({
  polls,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  filters,
  organizations,
  initialBoards,
  userId,
  adminOrgIds,
  isSuperAdmin,
}: PollsListUrlProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Local state only for debounced search input
  const [searchValue, setSearchValue] = useState(filters.search);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const buildUrl = useCallback(
    (updates: Partial<PollFilters> & { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...updates };
      if (merged.search) params.set('search', merged.search);
      if (merged.status) params.set('status', merged.status);
      if (merged.orgId) params.set('orgId', merged.orgId);
      if (merged.boardId) params.set('boardId', merged.boardId);
      if (merged.createdFrom) params.set('createdFrom', merged.createdFrom);
      if (merged.createdTo) params.set('createdTo', merged.createdTo);
      if (merged.startFrom) params.set('startFrom', merged.startFrom);
      if (merged.startTo) params.set('startTo', merged.startTo);
      const ps = updates.pageSize ?? pageSize;
      if (ps !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(ps));
      const p = updates.page ?? 1;
      if (p > 1) params.set('page', String(p));
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pageSize, pathname]
  );

  const navigateWithFilter = useCallback(
    (updates: Partial<PollFilters>) => {
      router.push(buildUrl({ ...updates, page: 1 }));
    },
    [buildUrl, router]
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  return (
    <PollsListView
      polls={polls}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      isPending={false}
      searchValue={searchValue}
      status={filters.status}
      organizationId={filters.orgId}
      boardId={filters.boardId}
      createdFrom={filters.createdFrom}
      createdTo={filters.createdTo}
      startFrom={filters.startFrom}
      startTo={filters.startTo}
      organizations={organizations}
      boards={initialBoards}
      userId={userId}
      adminOrgIds={adminOrgIds}
      isSuperAdmin={isSuperAdmin}
      onSearchChange={handleSearchChange}
      onStatusChange={(v) => navigateWithFilter({ status: v })}
      onOrganizationChange={(v) =>
        navigateWithFilter({ orgId: v, boardId: '' })
      }
      onBoardChange={(v) => navigateWithFilter({ boardId: v })}
      onCreatedFromChange={(v) => navigateWithFilter({ createdFrom: v })}
      onCreatedToChange={(v) => navigateWithFilter({ createdTo: v })}
      onStartFromChange={(v) => navigateWithFilter({ startFrom: v })}
      onStartToChange={(v) => navigateWithFilter({ startTo: v })}
      onPageChange={(p) => router.push(buildUrl({ page: p }))}
      onPageSizeChange={(s) => router.push(buildUrl({ page: 1, pageSize: s }))}
      onResetFilters={() => {
        setSearchValue('');
        router.push(pathname);
      }}
      onPollStateChange={() => router.refresh()}
    />
  );
}
```

- [ ] **Step 5: Update `/organizations/[id]/page.tsx` import**

Change `import { PollsList } from ...` to point to the local-state version (which is still `PollsList`). No behavior change.

- [ ] **Step 6: Test in browser**

1. `/polls` — filters in URL, refresh preserves them, pagination works, page size persists, reset clears URL (re-applies default `createdFrom`), board dropdown loads when org selected
2. `/organizations/[id]` — polls section still works with local state, no URL params pollution

- [ ] **Step 7: Commit**

```bash
git add src/web/components/polls/ src/app/[locale]/polls/page.tsx src/app/[locale]/organizations/[id]/page.tsx
git commit -m "refactor: polls list filters to URL params on /polls page"
```

---

## Task 3: Organizations List — URL Params Filters

**Complexity:** Low-medium — only `search` filter + infinite scroll pagination.

**Filters:** `search`

**Design decision:** OrganizationsList uses infinite scroll (IntersectionObserver). URL params + infinite scroll is awkward. Two approaches:

- **Option A:** Keep infinite scroll, store `search` in URL only. Don't store page in URL. On navigation with search param, server fetches page 1, client can still load more.
- **Option B:** Switch to standard pagination (prev/next) + store `search` and `page` in URL.

**Recommended: Option A.** The search is the only meaningful shareable filter. Infinite scroll is a good UX for browsing orgs. We just need the search to be in the URL. Page number in URL doesn't add much value here since the list is browse-oriented.

This component is shared between `/organizations` and `/superadmin/organizations` with a custom `searchAction` prop. Both consumers should pass `searchParams.search` to the component.

### Files:

- Modify: `src/app/[locale]/organizations/OrganizationsList.tsx`
- Modify: `src/app/[locale]/organizations/page.tsx`
- Modify: `src/app/[locale]/superadmin/organizations/page.tsx`
- Modify: `src/app/[locale]/superadmin/organizations/SuperadminOrganizationsList.tsx`

### Steps:

- [ ] **Step 1: Update both `page.tsx` files to accept searchParams**

`/organizations/page.tsx`:

```tsx
interface OrganizationsPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const params = await searchParams;
  // ... existing code ...

  const result = await searchOrganizationsNotAlreadyMemberOfAction({
    search: params.search || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // Pass initialSearch to OrganizationsList
  <OrganizationsList
    initialOrganizations={organizations}
    initialTotalCount={totalCount}
    userId={user.id}
    initialSearch={params.search ?? ''}
  />
```

`/superadmin/organizations/page.tsx` — same approach:

```tsx
interface SuperadminOrganizationsPageProps {
  searchParams: Promise<{ search?: string }>;
}
// ... parse params.search, pass to searchAllOrganizationsAction, pass initialSearch down
```

`SuperadminOrganizationsList.tsx` — pass `initialSearch` through to `OrganizationsList`.

- [ ] **Step 2: Update `OrganizationsList.tsx` to sync search with URL**

Add `initialSearch` prop. Import `usePathname` from `next/navigation`. Initialize `search` state from `initialSearch`.

**Approach:** The debounced search `useEffect` updates the URL via `router.push()`. This causes the server component to re-render with new `searchParams`, fetch page 1 results, and pass them as new `initialOrganizations` props. The client needs to react to prop changes — but carefully, to avoid losing "load more" data.

**Race condition prevention:** A naive `useEffect` on `initialOrganizations` would reset state on every server re-render, potentially discarding pages loaded via infinite scroll. Instead, track a `lastSyncedSearch` ref. Only reset the list when the `initialSearch` prop (from server) changes — this only happens on URL navigation, not on arbitrary re-renders.

```tsx
interface OrganizationsListProps {
  // ... existing props ...
  initialSearch?: string;
}

export function OrganizationsList({
  initialOrganizations,
  initialTotalCount,
  renderActions,
  searchAction,
  showArchivedBadge,
  initialSearch = '',
}: OrganizationsListProps) {
  // ...
  const [search, setSearch] = useState(initialSearch);
  const pathname = usePathname();
  const lastSyncedSearchRef = useRef(initialSearch);

  // Sync state when server re-renders with new search results
  // Only fires when initialSearch changes (URL navigation), NOT on arbitrary re-renders
  useEffect(() => {
    if (initialSearch !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = initialSearch;
      setOrganizations(initialOrganizations);
      setTotalCount(initialTotalCount);
      setPage(1);
    }
  }, [initialSearch, initialOrganizations, initialTotalCount]);

  // Debounced search: update URL (server will fetch & pass new data)
  // Replaces the existing useEffect that called effectiveSearchAction
  useEffect(() => {
    if (search === initialSearch) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, initialSearch, pathname, router]);
```

**What to remove:** The existing `useEffect` (lines 111-135 in `OrganizationsList.tsx`) that calls `effectiveSearchAction` on search change. The server now handles search fetching via URL params.

**What stays unchanged:** The `loadMore` callback and `IntersectionObserver` — they call `effectiveSearchAction` directly for page 2+ data (not URL-driven). The `refetchList` callback used after archive/unarchive actions.

- [ ] **Step 3: Test in browser**

1. `/organizations` — type in search, URL updates, refresh preserves search, clearing search removes param, infinite scroll still loads more pages
2. `/superadmin/organizations` — same behavior, archive/unarchive actions still work

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/organizations/ src/app/[locale]/superadmin/organizations/
git commit -m "refactor: organizations list search to URL params"
```

---

## Task 4: Pending Requests — URL Params for Pagination

**Complexity:** Low — only `page` and `pageSize`, no search filters.

**Filters:** `page`, `pageSize`

### Files:

- Modify: `src/app/[locale]/organizations/[id]/pending-requests/page.tsx`
- Modify: `src/app/[locale]/organizations/[id]/pending-requests/OrgPendingRequestsList.tsx`

### Steps:

- [ ] **Step 1: Update `page.tsx` to accept searchParams**

```tsx
type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function OrganizationPendingRequestsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: organizationId, locale } = await params;
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : DEFAULT_PAGE_SIZE;

  // ... existing access checks ...

  const requestsResult = await getOrganizationPendingRequestsAction(
    organizationId,
    page,
    pageSize
  );

  // Pass currentPage + pageSize to client
  <OrgPendingRequestsList
    organizationId={organizationId}
    organizationName={organization.name}
    requests={requestsResult.data.requests}
    totalCount={requestsResult.data.totalCount}
    currentPage={page}
    pageSize={pageSize}
  />
```

Add `const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];` at the top.

- [ ] **Step 2: Refactor `OrgPendingRequestsList.tsx` to use URL params**

Replace `defaultPageSize` prop with `currentPage` and `pageSize` props. Remove local state for `currentPage` and `pageSize`. Add `buildUrl`. Remove `fetchPage` calls — after accept/reject, call `router.refresh()`. Add `const DEFAULT_PAGE_SIZE = 10;` constant at module level.

```tsx
interface OrgPendingRequestsListProps {
  organizationId: string;
  organizationName: string;
  requests: OrgPendingRequest[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function OrgPendingRequestsList({
  organizationId,
  organizationName,
  requests: initialRequests,
  totalCount: initialTotalCount,
  currentPage,
  pageSize,
}: OrgPendingRequestsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Keep requests/totalCount in state for optimistic updates after accept/reject
  const [requests, setRequests] = useState(initialRequests);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

  // Sync with server data when props change (URL navigation)
  useEffect(() => {
    setRequests(initialRequests);
    setTotalCount(initialTotalCount);
  }, [initialRequests, initialTotalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const buildUrl = useCallback(
    (updates: { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams();
      const p = updates.page ?? currentPage;
      const ps = updates.pageSize ?? pageSize;
      if (p > 1) params.set('page', String(p));
      if (ps !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(ps));
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [currentPage, pageSize, pathname]
  );

  const handlePageChange = (page: number) => {
    router.push(buildUrl({ page }));
  };

  const handlePageSizeChange = (newSize: number) => {
    router.push(buildUrl({ page: 1, pageSize: newSize }));
  };
```

For `handleAccept` and `handleRejectConfirm` success: replace `await fetchPage(currentPage, pageSize)` with `router.refresh()`.

Remove `fetchPage` callback, `isLoading` state (for fetch — keep `isProcessing` for dialogs).

- [ ] **Step 3: Test in browser**

1. Navigate to pending requests page — pagination in URL
2. Change page size — URL updates, page resets to 1
3. Accept/reject request — page refreshes with current URL
4. Refresh preserves page/pageSize

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/organizations/[id]/pending-requests/
git commit -m "refactor: pending requests pagination to URL params"
```

---

## Resolved Questions

1. **Suspicious activity — "load more" → pagination:** Yes, switch to standard prev/next.
2. **Polls on org detail page:** Yes, keep local state there, URL params only on `/polls`.
3. **Orgs list — infinite scroll + URL search:** Yes, hybrid approach accepted.
