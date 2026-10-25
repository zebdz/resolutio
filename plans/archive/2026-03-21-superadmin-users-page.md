# Superadmin Users Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild superadmin users page with paginated list, search, filters (date range, privacy toggles, block status, org membership), enriched user cards (org chips, poll count), and polls dialog.

**Architecture:** URL search params drive all state. Server page reads params → calls server action → serializes → passes to client component. Combobox for org filter calls a separate search action client-side. Existing block/unblock dialogs unchanged.

**Tech Stack:** Next.js 15, Prisma, Headless UI (Catalyst combobox/select), next-intl, Tailwind

**Spec:** `docs/superpowers/specs/2026-03-21-superadmin-users-page-design.md`

---

### Task 1: Add localization messages

**Files:**

- Modify: `messages/en.json` (superadmin.users section)
- Modify: `messages/ru.json` (superadmin.users section)

- [ ] **Step 1: Add new keys to en.json**

Add these keys inside `"superadmin" > "users"`:

```json
"createdAtLabel": "Registered",
"allowFindByNameLabel": "Find by name",
"allowFindByPhoneLabel": "Find by phone",
"blockStatusLabel": "Status",
"organizationLabel": "Organization",
"dateFromLabel": "From",
"dateToLabel": "To",
"filterAll": "All",
"filterYes": "Yes",
"filterNo": "No",
"filterBlocked": "Blocked",
"filterUnblocked": "Unblocked",
"totalUsers": "{count} users found",
"pageOf": "Page {current} of {total}",
"previous": "Previous",
"next": "Next",
"orgSearchPlaceholder": "Search organizations...",
"pollsButton": "Polls",
"pollsDialogTitle": "Polls: {name}",
"pollsEmpty": "No poll participation",
"pollsLoading": "Loading...",
"orgCount": "{count} orgs",
"pollCount": "{count} polls",
"privacyEnabled": "Yes",
"privacyDisabled": "No"
```

- [ ] **Step 2: Add same keys to ru.json**

```json
"createdAtLabel": "Зарегистрирован",
"allowFindByNameLabel": "Поиск по имени",
"allowFindByPhoneLabel": "Поиск по телефону",
"blockStatusLabel": "Статус",
"organizationLabel": "Организация",
"dateFromLabel": "С",
"dateToLabel": "По",
"filterAll": "Все",
"filterYes": "Да",
"filterNo": "Нет",
"filterBlocked": "Заблокирован",
"filterUnblocked": "Разблокирован",
"totalUsers": "Найдено пользователей: {count}",
"pageOf": "Страница {current} из {total}",
"previous": "Назад",
"next": "Далее",
"orgSearchPlaceholder": "Поиск организаций...",
"pollsButton": "Голосования",
"pollsDialogTitle": "Голосования: {name}",
"pollsEmpty": "Нет участия в голосованиях",
"pollsLoading": "Загрузка...",
"orgCount": "{count} орг.",
"pollCount": "{count} гол.",
"privacyEnabled": "Да",
"privacyDisabled": "Нет"
```

- [ ] **Step 3: Verify no syntax errors**

Run: `yarn build` or manually check JSON validity.

---

### Task 2: Add `SerializedAdminUserResult` type and `listUsersForAdminAction`

**Files:**

- Modify: `src/web/actions/suspiciousActivity.ts`

**References:**

- Existing `AdminUserResult` (line 35-44) — keep as-is
- Existing `getBlockStatusForUser` (line 46-68) — reuse
- Existing `getSuspiciousActivitySummaryAction` (line 70-223) — pagination pattern reference
- Prisma schema: `users`, `user_block_statuses`, `organization_users`, `poll_participants` tables

- [ ] **Step 1: Add `SerializedAdminUserResult` interface**

Add after the existing `AdminUserResult` interface (after line 44):

```typescript
export interface SerializedAdminUserResult {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string;
  nickname: string;
  createdAt: string;
  allowFindByName: boolean;
  allowFindByPhone: boolean;
  organizations: { id: string; name: string }[];
  organizationCount: number;
  pollCount: number;
  blockStatus: {
    blocked: boolean;
    reason?: string;
    blockedAt?: string;
  } | null;
}
```

- [ ] **Step 2: Add `Prisma` import for raw SQL**

Add to existing imports:

```typescript
import { Prisma } from '@/generated/prisma/client';
```

- [ ] **Step 3: Add `getBlockedUserIds` helper**

Add after `getBlockStatusForUser` function:

```typescript
async function getBlockedUserIds(): Promise<string[]> {
  const result = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT user_id FROM (
      SELECT DISTINCT ON (user_id) user_id, status
      FROM user_block_statuses
      ORDER BY user_id, created_at DESC
    ) latest
    WHERE status = 'blocked'
  `;
  return result.map((r) => r.user_id);
}
```

- [ ] **Step 4: Add `listUsersForAdminAction`**

Add at the end of the file:

```typescript
export async function listUsersForAdminAction(input: {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  allowFindByName?: 'yes' | 'no';
  allowFindByPhone?: 'yes' | 'no';
  blockStatus?: 'blocked' | 'unblocked';
  organizationId?: string;
}): Promise<
  ActionResult<{
    users: SerializedAdminUserResult[];
    totalCount: number;
    totalPages: number;
  }>
> {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const auth = await requireSuperadmin();
  if (isError(auth)) return auth;

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;

  // Build WHERE clauses
  const whereAnd: any[] = [];

  if (input.search?.trim()) {
    const search = input.search.trim();
    whereAnd.push({
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (input.dateFrom) {
    whereAnd.push({ createdAt: { gte: new Date(input.dateFrom) } });
  }

  if (input.dateTo) {
    whereAnd.push({
      createdAt: { lte: new Date(input.dateTo + 'T23:59:59.999Z') },
    });
  }

  if (input.allowFindByName === 'yes') {
    whereAnd.push({ allowFindByName: true });
  } else if (input.allowFindByName === 'no') {
    whereAnd.push({ allowFindByName: false });
  }

  if (input.allowFindByPhone === 'yes') {
    whereAnd.push({ allowFindByPhone: true });
  } else if (input.allowFindByPhone === 'no') {
    whereAnd.push({ allowFindByPhone: false });
  }

  // Block status filter: get blocked user IDs, then filter
  if (input.blockStatus) {
    const blockedIds = await getBlockedUserIds();
    if (input.blockStatus === 'blocked') {
      whereAnd.push({
        id: { in: blockedIds.length > 0 ? blockedIds : ['__none__'] },
      });
    } else {
      if (blockedIds.length > 0) {
        whereAnd.push({ id: { notIn: blockedIds } });
      }
    }
  }

  // Organization filter: get member user IDs
  if (input.organizationId) {
    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId: input.organizationId,
        status: 'accepted',
      },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    whereAnd.push({
      id: { in: memberIds.length > 0 ? memberIds : ['__none__'] },
    });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  // Fetch users + count in parallel
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        nickname: true,
        createdAt: true,
        allowFindByName: true,
        allowFindByPhone: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((u) => u.id);

  // Batch enrichment queries (only if there are users)
  const [blockStatuses, orgMemberships, pollCounts] =
    userIds.length > 0
      ? await Promise.all([
          // Latest block status per user
          prisma.userBlockStatus.findMany({
            where: { userId: { in: userIds } },
            orderBy: { createdAt: 'desc' },
            distinct: ['userId'],
            select: {
              userId: true,
              status: true,
              reason: true,
              createdAt: true,
            },
          }),
          // Org memberships
          prisma.organizationUser.findMany({
            where: { userId: { in: userIds }, status: 'accepted' },
            select: {
              userId: true,
              organization: { select: { id: true, name: true } },
            },
          }),
          // Poll participation counts (using poll_participants, the authoritative participation record)
          prisma.$queryRaw<{ user_id: string; count: bigint }[]>`
            SELECT pp.user_id, COUNT(*) as count
            FROM poll_participants pp
            WHERE pp.user_id IN (${Prisma.join(userIds)})
            GROUP BY pp.user_id
          `,
        ])
      : [[], [], []];

  // Build lookup maps
  const blockStatusMap = new Map(
    blockStatuses.map((bs) => [
      bs.userId,
      bs.status === 'blocked'
        ? {
            blocked: true as const,
            reason: bs.reason ?? undefined,
            blockedAt: bs.createdAt.toISOString(),
          }
        : { blocked: false as const },
    ])
  );

  const orgMap = new Map<string, { id: string; name: string }[]>();
  for (const m of orgMemberships) {
    const existing = orgMap.get(m.userId) ?? [];
    existing.push(m.organization);
    orgMap.set(m.userId, existing);
  }

  const pollCountMap = new Map(
    pollCounts.map((pc) => [pc.user_id, Number(pc.count)])
  );

  // Serialize
  const serializedUsers: SerializedAdminUserResult[] = users.map((user) => {
    const orgs = orgMap.get(user.id) ?? [];
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phoneNumber: user.phoneNumber,
      nickname: user.nickname,
      createdAt: user.createdAt.toISOString(),
      allowFindByName: user.allowFindByName,
      allowFindByPhone: user.allowFindByPhone,
      organizations: orgs,
      organizationCount: orgs.length,
      pollCount: pollCountMap.get(user.id) ?? 0,
      blockStatus: blockStatusMap.get(user.id) ?? null,
    };
  });

  return {
    success: true,
    data: {
      users: serializedUsers,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}
```

- [ ] **Step 5: Verify the file compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 3: Add `searchOrganizationsForFilterAction`

**Files:**

- Modify: `src/web/actions/suspiciousActivity.ts`

- [ ] **Step 1: Add the action**

Add at end of file:

```typescript
export async function searchOrganizationsForFilterAction(input: {
  query: string;
}): Promise<ActionResult<{ id: string; name: string }[]>> {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const auth = await requireSuperadmin();
  if (isError(auth)) return auth;

  if (input.query.length < 2) {
    return { success: true, data: [] };
  }

  const orgs = await prisma.organization.findMany({
    where: {
      name: { contains: input.query, mode: 'insensitive' },
      archivedAt: null,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 20,
  });

  return { success: true, data: orgs };
}
```

- [ ] **Step 2: Verify compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 4: Add `getUserPollsAction`

**Files:**

- Modify: `src/web/actions/suspiciousActivity.ts`

**References:**

- Prisma schema: `poll_participants` → `polls` → `organizations`

- [ ] **Step 1: Add `UserPollResult` type and action**

Add at end of file:

```typescript
export interface UserPollResult {
  id: string;
  title: string;
  createdAt: string;
  organizationId: string;
  organizationName: string;
}

export async function getUserPollsAction(input: {
  userId: string;
}): Promise<ActionResult<UserPollResult[]>> {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const auth = await requireSuperadmin();
  if (isError(auth)) return auth;

  const polls = await prisma.$queryRaw<
    {
      id: string;
      title: string;
      created_at: Date;
      organization_id: string;
      organization_name: string;
    }[]
  >`
    SELECT p.id, p.title, p.created_at, p.organization_id, o.name as organization_name
    FROM poll_participants pp
    JOIN polls p ON pp.poll_id = p.id
    JOIN organizations o ON p.organization_id = o.id
    WHERE pp.user_id = ${input.userId}
    ORDER BY p.created_at DESC
  `;

  return {
    success: true,
    data: polls.map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.created_at.toISOString(),
      organizationId: p.organization_id,
      organizationName: p.organization_name,
    })),
  };
}
```

- [ ] **Step 2: Verify compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 5: Add `getOrganizationNameAction` helper

**Files:**

- Modify: `src/web/actions/suspiciousActivity.ts`

This is needed so the server page can resolve an org ID from URL params into a name for the combobox display.

- [ ] **Step 1: Add the action**

```typescript
export async function getOrganizationNameAction(input: {
  organizationId: string;
}): Promise<ActionResult<{ id: string; name: string } | null>> {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const auth = await requireSuperadmin();
  if (isError(auth)) return auth;

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });

  return { success: true, data: org };
}
```

- [ ] **Step 2: Verify compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 6: Rewrite server page (`page.tsx`)

**Files:**

- Modify: `src/app/[locale]/superadmin/users/page.tsx`

**References:**

- Current page.tsx (simple, just renders heading + panel)
- New `listUsersForAdminAction`, `getOrganizationNameAction`

- [ ] **Step 1: Rewrite page.tsx**

Replace entire file with:

```typescript
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { UserManagementPanel } from './UserManagementPanel';
import {
  listUsersForAdminAction,
  getOrganizationNameAction,
} from '@/web/actions/suspiciousActivity';

const PAGE_SIZE = 10;

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    allowName?: string;
    allowPhone?: string;
    blockStatus?: string;
    orgId?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const t = await getTranslations('superadmin.users');
  const tHub = await getTranslations('superadmin.hub');
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const result = await listUsersForAdminAction({
    page,
    pageSize: PAGE_SIZE,
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    allowFindByName:
      params.allowName === 'yes' || params.allowName === 'no'
        ? params.allowName
        : undefined,
    allowFindByPhone:
      params.allowPhone === 'yes' || params.allowPhone === 'no'
        ? params.allowPhone
        : undefined,
    blockStatus:
      params.blockStatus === 'blocked' || params.blockStatus === 'unblocked'
        ? params.blockStatus
        : undefined,
    organizationId: params.orgId || undefined,
  });

  // Resolve org name for combobox display if orgId is set
  let selectedOrg: { id: string; name: string } | null = null;
  if (params.orgId) {
    const orgResult = await getOrganizationNameAction({
      organizationId: params.orgId,
    });
    if (orgResult.success && orgResult.data) {
      selectedOrg = orgResult.data;
    }
  }

  const data = result.success
    ? result.data
    : { users: [], totalCount: 0, totalPages: 0 };

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

      <UserManagementPanel
        users={data.users}
        totalCount={data.totalCount}
        totalPages={data.totalPages}
        currentPage={page}
        filters={{
          search: params.search ?? '',
          dateFrom: params.dateFrom ?? '',
          dateTo: params.dateTo ?? '',
          allowName: params.allowName ?? '',
          allowPhone: params.allowPhone ?? '',
          blockStatus: params.blockStatus ?? '',
          orgId: params.orgId ?? '',
        }}
        selectedOrg={selectedOrg}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles (expect errors until Task 7)**

Note: This will have type errors until `UserManagementPanel` is updated in Task 7. That's expected.

---

### Task 7: Rewrite `UserManagementPanel.tsx`

**Files:**

- Modify: `src/app/[locale]/superadmin/users/UserManagementPanel.tsx`

**References:**

- Catalyst components: `Combobox`, `ComboboxOption` from `catalyst/combobox`, `Select` from `catalyst/select`
- Existing `BlockUserDialog`, `BlockHistoryDialog` — unchanged, reuse as-is
- `User.formatFullName` for name display
- `searchOrganizationsForFilterAction` for org combobox
- `router.push()` for URL updates, `router.refresh()` for post-action refresh

- [ ] **Step 1: Replace entire file**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Select } from '@/app/components/catalyst/select';
import { Text } from '@/app/components/catalyst/text';
import {
  Combobox,
  ComboboxOption,
  ComboboxLabel,
} from '@/app/components/catalyst/combobox';
import {
  blockUserAction,
  unblockUserAction,
  getUserBlockHistoryAction,
  searchOrganizationsForFilterAction,
  type SerializedAdminUserResult,
  type UserBlockHistoryEntry,
} from '@/web/actions/suspiciousActivity';
import { BlockUserDialog } from './BlockUserDialog';
import { BlockHistoryDialog } from './BlockHistoryDialog';
import { UserPollsDialog } from './UserPollsDialog';
import { User } from '@/domain/user/User';
import { Link } from '@/src/i18n/routing';

interface Filters {
  search: string;
  dateFrom: string;
  dateTo: string;
  allowName: string;
  allowPhone: string;
  blockStatus: string;
  orgId: string;
}

interface UserManagementPanelProps {
  users: SerializedAdminUserResult[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  filters: Filters;
  selectedOrg: { id: string; name: string } | null;
}

export function UserManagementPanel({
  users,
  totalCount,
  totalPages,
  currentPage,
  filters,
  selectedOrg,
}: UserManagementPanelProps) {
  const t = useTranslations('superadmin.users');
  const router = useRouter();
  const pathname = usePathname();

  // Dialog state
  const [blockTarget, setBlockTarget] =
    useState<SerializedAdminUserResult | null>(null);
  const [unblockTarget, setUnblockTarget] =
    useState<SerializedAdminUserResult | null>(null);
  const [unblockReason, setUnblockReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unblockDialogError, setUnblockDialogError] = useState<string | null>(
    null
  );
  const [historyTarget, setHistoryTarget] =
    useState<SerializedAdminUserResult | null>(null);
  const [historyEntries, setHistoryEntries] = useState<
    UserBlockHistoryEntry[]
  >([]);
  const [pollsTarget, setPollsTarget] =
    useState<SerializedAdminUserResult | null>(null);

  // Org combobox state
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>(
    selectedOrg ? [selectedOrg] : []
  );
  const [orgSearchTimer, setOrgSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Search debounce
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [searchValue, setSearchValue] = useState(filters.search);

  // Build URL with updated params
  const buildUrl = useCallback(
    (updates: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...updates };

      if (merged.search) params.set('search', merged.search);
      if (merged.dateFrom) params.set('dateFrom', merged.dateFrom);
      if (merged.dateTo) params.set('dateTo', merged.dateTo);
      if (merged.allowName) params.set('allowName', merged.allowName);
      if (merged.allowPhone) params.set('allowPhone', merged.allowPhone);
      if (merged.blockStatus) params.set('blockStatus', merged.blockStatus);
      if (merged.orgId) params.set('orgId', merged.orgId);

      const page = updates.page ?? 1;
      if (page > 1) params.set('page', String(page));

      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pathname]
  );

  const navigateWithFilter = useCallback(
    (updates: Partial<Filters>) => {
      router.push(buildUrl({ ...updates, page: 1 }));
    },
    [buildUrl, router]
  );

  // Search handler with debounce
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  // Org combobox search
  const handleOrgSearch = async (query: string) => {
    if (orgSearchTimer) clearTimeout(orgSearchTimer);
    if (query.length < 2) {
      setOrgOptions(selectedOrg ? [selectedOrg] : []);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await searchOrganizationsForFilterAction({ query });
      if (result.success) {
        setOrgOptions(result.data);
      }
    }, 300);
    setOrgSearchTimer(timer);
  };

  // Block/unblock handlers
  const handleBlock = async (reason: string) => {
    if (!blockTarget) return { success: false as const, error: 'No target' };
    const result = await blockUserAction({ userId: blockTarget.id, reason });
    if (result.success) {
      setBlockTarget(null);
      router.refresh();
    }
    return result;
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    if (!unblockReason.trim()) {
      setUnblockDialogError(t('reasonRequired'));
      return;
    }
    setIsLoading(true);
    setUnblockDialogError(null);
    const result = await unblockUserAction({
      userId: unblockTarget.id,
      reason: unblockReason.trim(),
    });
    if (result.success) {
      setUnblockTarget(null);
      setUnblockReason('');
      router.refresh();
    } else if (result.fieldErrors?.reason) {
      setUnblockDialogError(result.fieldErrors.reason[0]);
    } else {
      setUnblockDialogError(result.error);
    }
    setIsLoading(false);
  };

  const handleShowHistory = async (user: SerializedAdminUserResult) => {
    setHistoryTarget(user);
    const result = await getUserBlockHistoryAction({ userId: user.id });
    if (result.success) {
      setHistoryEntries(result.data);
    }
  };

  const getUserName = (user: SerializedAdminUserResult) =>
    User.formatFullName(user.firstName, user.lastName, user.middleName);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        {/* Search */}
        <Input
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
        />

        {/* Filter row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Date from */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('dateFromLabel')}
            </label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                navigateWithFilter({ dateFrom: e.target.value })
              }
            />
          </div>

          {/* Date to */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('dateToLabel')}
            </label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                navigateWithFilter({ dateTo: e.target.value })
              }
            />
          </div>

          {/* Allow find by name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('allowFindByNameLabel')}
            </label>
            <Select
              value={filters.allowName}
              onChange={(e) =>
                navigateWithFilter({ allowName: e.target.value })
              }
            >
              <option value="">{t('filterAll')}</option>
              <option value="yes">{t('filterYes')}</option>
              <option value="no">{t('filterNo')}</option>
            </Select>
          </div>

          {/* Allow find by phone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('allowFindByPhoneLabel')}
            </label>
            <Select
              value={filters.allowPhone}
              onChange={(e) =>
                navigateWithFilter({ allowPhone: e.target.value })
              }
            >
              <option value="">{t('filterAll')}</option>
              <option value="yes">{t('filterYes')}</option>
              <option value="no">{t('filterNo')}</option>
            </Select>
          </div>

          {/* Block status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('blockStatusLabel')}
            </label>
            <Select
              value={filters.blockStatus}
              onChange={(e) =>
                navigateWithFilter({ blockStatus: e.target.value })
              }
            >
              <option value="">{t('filterAll')}</option>
              <option value="blocked">{t('filterBlocked')}</option>
              <option value="unblocked">{t('filterUnblocked')}</option>
            </Select>
          </div>

          {/* Organization combobox */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('organizationLabel')}
            </label>
            <Combobox
              options={orgOptions}
              displayValue={(org) => org?.name ?? ''}
              value={selectedOrg}
              onChange={(org) => {
                navigateWithFilter({ orgId: org?.id ?? '' });
              }}
              placeholder={t('orgSearchPlaceholder')}
            >
              {(org) => (
                <ComboboxOption key={org.id} value={org}>
                  <ComboboxLabel>{org.name}</ComboboxLabel>
                </ComboboxOption>
              )}
            </Combobox>
          </div>
        </div>
      </div>

      {/* Total count */}
      <Text className="text-sm text-zinc-500">
        {t('totalUsers', { count: totalCount })}
      </Text>

      {/* User list */}
      {users.length === 0 ? (
        <Text className="text-sm text-zinc-500">{t('noResults')}</Text>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              {/* Top row: name + actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{getUserName(user)}</div>
                  <div className="text-sm text-zinc-500">
                    @{user.nickname} &middot; {user.phoneNumber}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Polls button */}
                  <Button
                    plain
                    onClick={() => setPollsTarget(user)}
                    className="text-xs"
                  >
                    {t('pollsButton')} ({user.pollCount})
                  </Button>

                  {/* History button — always shown, dialog handles empty state */}
                  <Button
                    plain
                    onClick={() => handleShowHistory(user)}
                    className="text-xs"
                  >
                    {t('history')}
                  </Button>

                  {/* Block status + action */}
                  {user.blockStatus?.blocked ? (
                    <>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {t('blocked')}
                      </span>
                      <Button
                        color="brand-green"
                        onClick={() => {
                          setUnblockTarget(user);
                          setUnblockDialogError(null);
                          setUnblockReason('');
                        }}
                        className="text-xs"
                      >
                        {t('unblockUser')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {t('active')}
                      </span>
                      <Button
                        color="red"
                        onClick={() => setBlockTarget(user)}
                        className="text-xs"
                      >
                        {t('blockUser')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Details row */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                <span>
                  {t('createdAtLabel')}:{' '}
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
                <span>
                  {t('allowFindByNameLabel')}:{' '}
                  {user.allowFindByName
                    ? t('privacyEnabled')
                    : t('privacyDisabled')}
                </span>
                <span>
                  {t('allowFindByPhoneLabel')}:{' '}
                  {user.allowFindByPhone
                    ? t('privacyEnabled')
                    : t('privacyDisabled')}
                </span>
              </div>

              {/* Org chips */}
              {user.organizations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.organizations.map((org) => (
                    <Link
                      key={org.id}
                      href={`/organizations/${org.id}`}
                      prefetch={false}
                      className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {org.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Block info if blocked */}
              {user.blockStatus?.blocked && (
                <div className="mt-2 space-y-1 text-sm text-zinc-500">
                  {user.blockStatus.reason && (
                    <div>
                      {t('blockedReason', { reason: user.blockStatus.reason })}
                    </div>
                  )}
                  {user.blockStatus.blockedAt && (
                    <div>
                      {t('blockedAt', {
                        date: new Date(
                          user.blockStatus.blockedAt
                        ).toLocaleDateString(),
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            plain
            disabled={currentPage <= 1}
            onClick={() =>
              router.push(buildUrl({ page: currentPage - 1 }))
            }
          >
            {t('previous')}
          </Button>
          <Text className="text-sm text-zinc-500">
            {t('pageOf', {
              current: currentPage,
              total: totalPages,
            })}
          </Text>
          <Button
            plain
            disabled={currentPage >= totalPages}
            onClick={() =>
              router.push(buildUrl({ page: currentPage + 1 }))
            }
          >
            {t('next')}
          </Button>
        </div>
      )}

      {/* Block dialog */}
      <BlockUserDialog
        isOpen={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        userName={blockTarget ? getUserName(blockTarget) : ''}
        onConfirm={handleBlock}
      />

      {/* Block history dialog */}
      <BlockHistoryDialog
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={t('historyTitle', {
          name: historyTarget ? getUserName(historyTarget) : '',
        })}
        entries={historyEntries}
        emptyLabel={t('historyEmpty')}
        blockedLabel={t('statusBlocked')}
        unblockedLabel={t('statusUnblocked')}
        changedByLabel={t('changedBy', { name: '{name}' })}
        closeLabel={t('cancel')}
      />

      {/* Unblock confirm dialog */}
      {unblockTarget && (
        <UnblockDialog
          user={unblockTarget}
          reason={unblockReason}
          error={unblockDialogError}
          isLoading={isLoading}
          onReasonChange={(val) => {
            setUnblockReason(val);
            setUnblockDialogError(null);
          }}
          onConfirm={handleUnblock}
          onClose={() => {
            setUnblockTarget(null);
            setUnblockDialogError(null);
            setUnblockReason('');
          }}
          getUserName={getUserName}
        />
      )}

      {/* Polls dialog */}
      <UserPollsDialog
        isOpen={!!pollsTarget}
        onClose={() => setPollsTarget(null)}
        userId={pollsTarget?.id ?? ''}
        userName={pollsTarget ? getUserName(pollsTarget) : ''}
      />
    </div>
  );
}

// Extracted to keep main component readable
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Textarea } from '@/app/components/catalyst/textarea';

function UnblockDialog({
  user,
  reason,
  error,
  isLoading,
  onReasonChange,
  onConfirm,
  onClose,
  getUserName,
}: {
  user: SerializedAdminUserResult;
  reason: string;
  error: string | null;
  isLoading: boolean;
  onReasonChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  getUserName: (user: SerializedAdminUserResult) => string;
}) {
  const t = useTranslations('superadmin.users');

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>{t('unblockConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('unblockConfirmDescription', { name: getUserName(user) })}
      </DialogDescription>
      <DialogBody>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('reasonLabel')}</label>
          <Textarea
            value={reason}
            invalid={!!error}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={t('unblockReasonPlaceholder')}
            rows={3}
          />
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button color="brand-green" onClick={onConfirm} disabled={isLoading}>
          {t('confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify compiles (expect errors until Task 8)**

Note: Will have import error for `UserPollsDialog` until Task 8.

---

### Task 8: Create `UserPollsDialog.tsx`

**Files:**

- Create: `src/app/[locale]/superadmin/users/UserPollsDialog.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import {
  getUserPollsAction,
  type UserPollResult,
} from '@/web/actions/suspiciousActivity';
import { Link } from '@/src/i18n/routing';

interface UserPollsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function UserPollsDialog({
  isOpen,
  onClose,
  userId,
  userName,
}: UserPollsDialogProps) {
  const t = useTranslations('superadmin.users');
  const [polls, setPolls] = useState<UserPollResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      getUserPollsAction({ userId }).then((result) => {
        if (result.success) {
          setPolls(result.data);
        }
        setLoading(false);
      });
    } else {
      setPolls([]);
    }
  }, [isOpen, userId]);

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{t('pollsDialogTitle', { name: userName })}</DialogTitle>
      <DialogBody>
        {loading ? (
          <Text className="text-sm text-zinc-500">{t('pollsLoading')}</Text>
        ) : polls.length === 0 ? (
          <Text className="text-sm text-zinc-500">{t('pollsEmpty')}</Text>
        ) : (
          <div className="space-y-2">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/polls/${poll.id}/results`}
                prefetch={false}
                className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <div className="font-medium">{poll.title}</div>
                <div className="text-sm text-zinc-500">
                  {poll.organizationName} &middot;{' '}
                  {new Date(poll.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify full build compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 9: Combobox integration fix — handle org search input changes

**Files:**

- Modify: `src/app/[locale]/superadmin/users/UserManagementPanel.tsx`

The Catalyst `Combobox` handles query internally but we need to trigger server search. The `Combobox` component's `onChange` on `ComboboxInput` fires on typing, and we use the `filter` prop to disable client-side filtering since results come from the server.

- [ ] **Step 1: Update Combobox to use server-side filtering**

In the org combobox section, update to pass a `filter` prop that always returns `true` (disable client filtering) and hook into the internal query changes:

```typescript
<Combobox
  options={orgOptions}
  displayValue={(org) => org?.name ?? ''}
  filter={() => true}
  value={selectedOrg}
  onChange={(org) => {
    navigateWithFilter({ orgId: org?.id ?? '' });
  }}
  placeholder={t('orgSearchPlaceholder')}
>
  {(org) => (
    <ComboboxOption key={org.id} value={org}>
      <ComboboxLabel>{org.name}</ComboboxLabel>
    </ComboboxOption>
  )}
</Combobox>
```

Note: The Catalyst Combobox's internal `ComboboxInput` `onChange` sets the internal query which triggers the `filter` function. Since our `filter` always returns `true`, all server-fetched options show. We need to intercept the typing. The Combobox component exposes `onChange` on `ComboboxInput` internally — we may need to extend it or use a wrapper approach.

**Alternative**: If the Catalyst Combobox doesn't support external search triggering natively, wrap it and use the Headless UI `Combobox` directly with a controlled query. Check if the internal `onChange` event on `ComboboxInput` (line 71 of combobox.tsx) can be extended.

Given the Catalyst Combobox handles query state internally (line 31: `const [query, setQuery] = useState('')`), the simplest approach is to add an `onQueryChange` callback prop to the Catalyst Combobox. But since we shouldn't modify shared components for one use case, instead use the Headless UI `Combobox` directly for this specific filter.

- [ ] **Step 2: Replace Catalyst Combobox with direct Headless UI usage for org filter**

In `UserManagementPanel.tsx`, replace the org combobox with a direct Headless UI implementation that supports server-side search. Update the import and the combobox section:

```typescript
// Add to imports
import * as Headless from '@headlessui/react';
```

Replace the org combobox `<div>` with:

```typescript
<div>
  <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
    {t('organizationLabel')}
  </label>
  <Headless.Combobox
    value={selectedOrg}
    onChange={(org: { id: string; name: string } | null) => {
      navigateWithFilter({ orgId: org?.id ?? '' });
    }}
    onClose={() => setOrgOptions(selectedOrg ? [selectedOrg] : [])}
  >
    <div className="relative">
      <Headless.ComboboxInput
        displayValue={(org: { id: string; name: string } | null) =>
          org?.name ?? ''
        }
        onChange={(e) => handleOrgSearch(e.target.value)}
        placeholder={t('orgSearchPlaceholder')}
        className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent py-[calc(--spacing(2.5)-1px)] pl-[calc(--spacing(3.5)-1px)] pr-[calc(--spacing(10)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white sm:py-[calc(--spacing(1.5)-1px)] sm:pl-[calc(--spacing(3)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:text-sm/6"
      />
      <Headless.ComboboxOptions
        anchor="bottom"
        className="z-50 mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-xl bg-white/75 p-1 shadow-lg ring-1 ring-zinc-950/10 backdrop-blur-xl empty:invisible dark:bg-zinc-800/75 dark:ring-white/10"
      >
        {orgOptions.map((org) => (
          <Headless.ComboboxOption
            key={org.id}
            value={org}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-zinc-950 data-focus:bg-brand-green data-focus:text-white dark:text-white"
          >
            {org.name}
          </Headless.ComboboxOption>
        ))}
      </Headless.ComboboxOptions>
    </div>
  </Headless.Combobox>
</div>
```

Remove the `Combobox, ComboboxOption, ComboboxLabel` imports from `catalyst/combobox` if no longer needed.

- [ ] **Step 3: Verify compiles**

Run: `yarn tsc --noEmit 2>&1 | head -30`

---

### Task 10: Manual verification

- [ ] **Step 1: Start dev server**

Run: `yarn dev`

- [ ] **Step 2: Navigate to `/ru/superadmin/users`**

Verify:

- Page loads with paginated user list (10 per page)
- Total count shown
- Pagination controls work (next/prev)
- All filter controls render

- [ ] **Step 3: Test search**

- Type in search box, verify debounce works (300ms)
- Results update after debounce
- Page resets to 1

- [ ] **Step 4: Test filters**

- Date range from/to
- Allow find by name (All/Yes/No)
- Allow find by phone (All/Yes/No)
- Block status (All/Blocked/Unblocked)
- Organization combobox search + select

- [ ] **Step 5: Test user card details**

- Full name, nickname, phone displayed
- Created at date shown
- Privacy settings shown
- Org chips shown and clickable
- Poll count shown

- [ ] **Step 6: Test Polls dialog**

- Click "Polls" button on a user card
- Dialog opens with loading state
- Polls listed with title + date
- Each poll is clickable link

- [ ] **Step 7: Test block/unblock**

- Block a user — verify refresh preserves filters
- Unblock a user — verify refresh preserves filters
- View block history

- [ ] **Step 8: Test URL persistence**

- Apply filters → copy URL → paste in new tab → same filters applied
- Navigate away and back → filters preserved
