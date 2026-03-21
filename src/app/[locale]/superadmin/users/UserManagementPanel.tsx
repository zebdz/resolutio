'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import * as Headless from '@headlessui/react';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Select } from '@/app/components/catalyst/select';
import { Text } from '@/app/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  blockUserAction,
  unblockUserAction,
  getUserBlockHistoryAction,
  getUserPollsForAdminAction,
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
  const [historyEntries, setHistoryEntries] = useState<UserBlockHistoryEntry[]>(
    []
  );
  const [pollsTarget, setPollsTarget] =
    useState<SerializedAdminUserResult | null>(null);
  const [pollsData, setPollsData] = useState<{
    polls: import('@/web/actions/suspiciousActivity').UserPollResult[];
    totalCount: number;
  }>({ polls: [], totalCount: 0 });
  const [pollsLoading, setPollsLoading] = useState(false);

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

      if (merged.search) {
        params.set('search', merged.search);
      }

      if (merged.dateFrom) {
        params.set('dateFrom', merged.dateFrom);
      }

      if (merged.dateTo) {
        params.set('dateTo', merged.dateTo);
      }

      if (merged.allowName) {
        params.set('allowName', merged.allowName);
      }

      if (merged.allowPhone) {
        params.set('allowPhone', merged.allowPhone);
      }

      if (merged.blockStatus) {
        params.set('blockStatus', merged.blockStatus);
      }

      if (merged.orgId) {
        params.set('orgId', merged.orgId);
      }

      const page = updates.page ?? 1;

      if (page > 1) {
        params.set('page', String(page));
      }

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

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  // Org combobox search
  const handleOrgSearch = (query: string) => {
    if (orgSearchTimer) {
      clearTimeout(orgSearchTimer);
    }

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
    if (!blockTarget) {
      return { success: false as const, error: 'No target' };
    }

    const result = await blockUserAction({ userId: blockTarget.id, reason });

    if (result.success) {
      setBlockTarget(null);
      router.refresh();
    }

    return result;
  };

  const handleUnblock = async () => {
    if (!unblockTarget) {
      return;
    }

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
              onChange={(e) => navigateWithFilter({ dateFrom: e.target.value })}
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
              onChange={(e) => navigateWithFilter({ dateTo: e.target.value })}
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

          {/* Organization combobox — using Headless UI directly for server-side search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {t('organizationLabel')}
            </label>
            <Headless.Combobox
              immediate={false}
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
        </div>

        {/* Clear filters — only shown when any filter is active */}
        {(filters.search ||
          filters.dateFrom ||
          filters.dateTo ||
          filters.allowName ||
          filters.allowPhone ||
          filters.blockStatus ||
          filters.orgId) && (
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
        )}
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
                    onClick={async () => {
                      setPollsTarget(user);
                      setPollsLoading(true);
                      const result = await getUserPollsForAdminAction({
                        userId: user.id,
                        page: 1,
                      });

                      if (result.success) {
                        setPollsData(result.data);
                      }

                      setPollsLoading(false);
                    }}
                    className="text-xs"
                  >
                    {t('pollsButton')} ({user.pollCount})
                  </Button>

                  {/* History button — always shown */}
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
                <span>{t('orgCount', { count: user.organizationCount })}</span>
                <span>{t('pollCount', { count: user.pollCount })}</span>
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
      {totalPages >= 1 && (
        <div className="flex items-center justify-between">
          <Button
            plain
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
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
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
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
        <Dialog
          open={true}
          onClose={() => {
            setUnblockTarget(null);
            setUnblockDialogError(null);
            setUnblockReason('');
          }}
        >
          <DialogTitle>{t('unblockConfirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('unblockConfirmDescription', {
              name: getUserName(unblockTarget),
            })}
          </DialogDescription>
          <DialogBody>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('reasonLabel')}</label>
              <Textarea
                value={unblockReason}
                invalid={!!unblockDialogError}
                onChange={(e) => {
                  setUnblockReason(e.target.value);
                  setUnblockDialogError(null);
                }}
                placeholder={t('unblockReasonPlaceholder')}
                rows={3}
              />
              {unblockDialogError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {unblockDialogError}
                </div>
              )}
            </div>
          </DialogBody>
          <DialogActions>
            <Button
              plain
              onClick={() => setUnblockTarget(null)}
              disabled={isLoading}
            >
              {t('cancel')}
            </Button>
            <Button
              color="brand-green"
              onClick={handleUnblock}
              disabled={isLoading}
            >
              {t('confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Polls dialog */}
      <UserPollsDialog
        isOpen={!!pollsTarget}
        onClose={() => {
          setPollsTarget(null);
          setPollsData({ polls: [], totalCount: 0 });
        }}
        userId={pollsTarget?.id ?? ''}
        userName={pollsTarget ? getUserName(pollsTarget) : ''}
        initialPolls={pollsData.polls}
        initialTotalCount={pollsData.totalCount}
        initialLoading={pollsLoading}
      />
    </div>
  );
}
