'use client';

import { useTranslations } from 'next-intl';
import * as Headless from '@headlessui/react';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { PollCard } from './PollCard';
import { PollState } from '@/domain/poll/PollState';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const ORG_WIDE_VALUE = '__org_wide__';

export interface PollsListViewProps {
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
  selectedOrg: { id: string; name: string } | null;
  orgOptions: Array<{ id: string; name: string }>;
  onOrgSearch: (query: string) => void;
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

export function PollsListView({
  polls,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  isPending,
  searchValue,
  status,
  organizationId,
  boardId,
  createdFrom,
  createdTo,
  startFrom,
  startTo,
  selectedOrg,
  orgOptions,
  onOrgSearch,
  boards,
  fixedOrganizationId,
  userId,
  adminOrgIds,
  isSuperAdmin,
  onSearchChange,
  onStatusChange,
  onOrganizationChange,
  onBoardChange,
  onCreatedFromChange,
  onCreatedToChange,
  onStartFromChange,
  onStartToChange,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  onPollStateChange,
}: PollsListViewProps) {
  const t = useTranslations('poll');
  const tPagination = useTranslations('common.pagination');

  const adminOrgIdSet = new Set(adminOrgIds);

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('filters')}
          </h3>
          <Button plain onClick={onResetFilters}>
            {t('resetFilters')}
          </Button>
        </div>

        {/* Row 1: name + status + (org) + board */}
        <div
          className={`grid gap-3 sm:grid-cols-2 ${fixedOrganizationId ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          <Input
            type="search"
            placeholder={t('filterByName')}
            value={searchValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange(e.target.value)
            }
          />

          <Select
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onStatusChange(e.target.value)
            }
          >
            <option value="">{t('allStatuses')}</option>
            <option value={PollState.DRAFT}>{t('draft')}</option>
            <option value={PollState.READY}>{t('ready')}</option>
            <option value={PollState.ACTIVE}>{t('active')}</option>
            <option value={PollState.FINISHED}>{t('finished')}</option>
          </Select>

          {!fixedOrganizationId && (
            <Headless.Combobox
              immediate={false}
              value={selectedOrg}
              onChange={(org: { id: string; name: string } | null) => {
                onOrganizationChange(org?.id ?? '');
              }}
              onClose={() => onOrgSearch('')}
            >
              <div className="relative">
                <Headless.ComboboxInput
                  displayValue={(org: { id: string; name: string } | null) =>
                    org?.name ?? ''
                  }
                  onChange={(e) => onOrgSearch(e.target.value)}
                  placeholder={t('allOrganizations')}
                  className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent py-[calc(--spacing(2.5)-1px)] pl-[calc(--spacing(3.5)-1px)] pr-[calc(--spacing(10)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white sm:py-[calc(--spacing(1.5)-1px)] sm:pl-[calc(--spacing(3)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:text-sm/6"
                />
                <Headless.ComboboxOptions
                  modal={false}
                  className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white/75 p-1 shadow-lg ring-1 ring-zinc-950/10 backdrop-blur-xl empty:invisible dark:bg-zinc-800/75 dark:ring-white/10"
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
          )}

          <Select
            value={boardId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onBoardChange(e.target.value)
            }
            disabled={!fixedOrganizationId && !organizationId}
          >
            <option value="">{t('allBoards')}</option>
            <option value={ORG_WIDE_VALUE}>{t('orgWidePoll')}</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Row 2: date filters */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {t('createdFrom')}
            </label>
            <Input
              type="date"
              value={createdFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onCreatedFromChange(e.target.value)
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {t('createdTo')}
            </label>
            <Input
              type="date"
              value={createdTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onCreatedToChange(e.target.value)
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {t('startsFrom')}
            </label>
            <Input
              type="date"
              value={startFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onStartFromChange(e.target.value)
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {t('startsTo')}
            </label>
            <Input
              type="date"
              value={startTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onStartToChange(e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="text-center text-sm text-zinc-500">...</div>
      )}

      {/* Poll grid */}
      {polls.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            {t('noFilteredPolls')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {polls.map((poll: any) => (
            <PollCard
              key={poll.id}
              poll={poll}
              userId={userId}
              canManage={isSuperAdmin || adminOrgIdSet.has(poll.organizationId)}
              onPollStateChange={onPollStateChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Text className="text-sm">{t('pollsPerPage')}</Text>
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="w-20"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>

          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            {tPagination('showing', {
              from: String(from),
              to: String(to),
              total: String(totalCount),
            })}
          </Text>

          <div className="flex items-center gap-2">
            <Button
              outline
              className={currentPage <= 1 || isPending ? '' : 'cursor-pointer'}
              disabled={currentPage <= 1 || isPending}
              onClick={() => onPageChange(currentPage - 1)}
            >
              {tPagination('previous')}
            </Button>
            <Text className="text-sm">
              {tPagination('page', {
                page: String(currentPage),
                totalPages: String(totalPages),
              })}
            </Text>
            <Button
              outline
              className={
                currentPage >= totalPages || isPending ? '' : 'cursor-pointer'
              }
              disabled={currentPage >= totalPages || isPending}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {tPagination('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
