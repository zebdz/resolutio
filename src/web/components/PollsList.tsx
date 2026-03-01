'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/app/components/catalyst/input';
import { Select } from '@/app/components/catalyst/select';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import { PollCard } from './PollCard';
import { searchPollsAction, SearchPollsInput } from '@/web/actions/poll';
import { getBoardsByOrganizationAction } from '@/web/actions/board';
import { PollState } from '@/domain/poll/PollState';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const ORG_WIDE_VALUE = '__org_wide__';

interface PollsListProps {
  initialPolls: any[];
  initialTotalCount: number;
  organizations?: Array<{ id: string; name: string }>;
  userId: string;
  adminOrgIds: string[];
  isSuperAdmin: boolean;
  fixedOrganizationId?: string;
  initialBoards?: Array<{ id: string; name: string }>;
}

function oneWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);

  return d.toISOString().split('T')[0];
}

export function PollsList({
  initialPolls,
  initialTotalCount,
  organizations,
  userId,
  adminOrgIds,
  isSuperAdmin,
  fixedOrganizationId,
  initialBoards,
}: PollsListProps) {
  const t = useTranslations('poll');
  const tPagination = useTranslations('common.pagination');
  const [isPending, startTransition] = useTransition();

  const [polls, setPolls] = useState(initialPolls);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [nameSearch, setNameSearch] = useState('');
  const [status, setStatus] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [createdFrom, setCreatedFrom] = useState(oneWeekAgo());
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');

  const [boards, setBoards] = useState<Array<{ id: string; name: string }>>(
    initialBoards ?? []
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Fetch boards when org changes (skip when fixedOrganizationId is set)
  useEffect(() => {
    if (fixedOrganizationId) {
      return;
    }

    if (!organizationId) {
      setBoards([]);
      setBoardId('');

      return;
    }

    getBoardsByOrganizationAction(organizationId).then((result) => {
      if (result.success) {
        setBoards(result.data);
      } else {
        setBoards([]);
      }

      setBoardId('');
    });
  }, [organizationId, fixedOrganizationId]);

  const fetchPolls = useCallback(
    (overrides?: Partial<SearchPollsInput>) => {
      const isOrgWide = boardId === ORG_WIDE_VALUE;
      const input: SearchPollsInput = {
        titleSearch: nameSearch || undefined,
        statuses: status ? [status as PollState] : undefined,
        organizationId: fixedOrganizationId || organizationId || undefined,
        boardId: isOrgWide ? undefined : boardId || undefined,
        orgWideOnly: isOrgWide || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
        page: currentPage,
        pageSize,
        ...overrides,
      };

      startTransition(async () => {
        const result = await searchPollsAction(input);

        if (result.success) {
          setPolls(result.data.polls);
          setTotalCount(result.data.totalCount);
        }
      });
    },
    [
      nameSearch,
      status,
      fixedOrganizationId,
      organizationId,
      boardId,
      createdFrom,
      createdTo,
      startFrom,
      startTo,
      currentPage,
      pageSize,
    ]
  );

  // Debounced name search — reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchPolls({ page: 1 });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSearch]);

  // Immediate fetch on non-debounced filter change — reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    fetchPolls({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    organizationId,
    boardId,
    createdFrom,
    createdTo,
    startFrom,
    startTo,
  ]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPolls({ page });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchPolls({ page: 1, pageSize: newSize });
  };

  const resetFilters = () => {
    setNameSearch('');
    setStatus('');

    if (!fixedOrganizationId) {
      setOrganizationId('');
    }

    setBoardId('');
    setCreatedFrom(oneWeekAgo());
    setCreatedTo('');
    setStartFrom('');
    setStartTo('');
    setCurrentPage(1);
  };

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
          <Button plain onClick={resetFilters}>
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
            value={nameSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNameSearch(e.target.value)
            }
          />

          <Select
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setStatus(e.target.value)
            }
          >
            <option value="">{t('allStatuses')}</option>
            <option value={PollState.DRAFT}>{t('draft')}</option>
            <option value={PollState.READY}>{t('ready')}</option>
            <option value={PollState.ACTIVE}>{t('active')}</option>
            <option value={PollState.FINISHED}>{t('finished')}</option>
          </Select>

          {!fixedOrganizationId && (
            <Select
              value={organizationId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setOrganizationId(e.target.value)
              }
            >
              <option value="">{t('allOrganizations')}</option>
              {(organizations ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            value={boardId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setBoardId(e.target.value)
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
                setCreatedFrom(e.target.value)
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
                setCreatedTo(e.target.value)
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
                setStartFrom(e.target.value)
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
                setStartTo(e.target.value)
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
              onPollStateChange={fetchPolls}
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
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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
              onClick={() => handlePageChange(currentPage - 1)}
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
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {tPagination('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
