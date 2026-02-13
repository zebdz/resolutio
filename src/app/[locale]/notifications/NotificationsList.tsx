'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Checkbox } from '@/app/components/catalyst/checkbox';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from '@/app/components/catalyst/dialog';
import {
  BuildingOffice2Icon,
  BellIcon,
  EnvelopeIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getNotificationsAction,
  deleteNotificationsAction,
} from '@/web/actions/notification';

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationsListProps {
  initialNotifications: NotificationData[];
  initialUnreadCount: number;
  initialTotalCount: number;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'org_joined_parent':
      return <BuildingOffice2Icon className="h-5 w-5 text-blue-500" />;
    case 'join_parent_request_received':
      return <EnvelopeIcon className="h-5 w-5 text-amber-500" />;
    default:
      return <BellIcon className="h-5 w-5 text-zinc-400" />;
  }
}

import { NOTIFICATIONS_PAGE_SIZE } from './constants';

export function NotificationsList({
  initialNotifications,
  initialUnreadCount,
  initialTotalCount,
}: NotificationsListProps) {
  const t = useTranslations('notification.page');
  const tTypes = useTranslations('notification.types');
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const hasMore = notifications.length < totalCount;

  const virtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  // Infinite scroll via scroll position
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    const result = await getNotificationsAction(
      NOTIFICATIONS_PAGE_SIZE,
      notifications.length
    );

    if (result.success) {
      setNotifications((prev) => [...prev, ...result.data.notifications]);
      setUnreadCount(result.data.unreadCount);
      setTotalCount(result.data.totalCount);
    }

    setLoadingMore(false);
  }, [loadingMore, hasMore, notifications.length]);

  useEffect(() => {
    const el = parentRef.current;

    if (!el) {
      return;
    }

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = el!;

      if (
        scrollHeight - scrollTop - clientHeight < 200 &&
        hasMore &&
        !loadingMore
      ) {
        loadMore();
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loadingMore, loadMore]);

  // Auto-load more if content doesn't fill the viewport
  useEffect(() => {
    const el = parentRef.current;

    if (!el || loadingMore || !hasMore) {
      return;
    }

    if (el.scrollHeight <= el.clientHeight) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore, notifications.length]);

  async function handleMarkAsRead(id: string) {
    setLoadingId(id);
    const result = await markNotificationReadAction(id);

    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setLoadingId(null);
  }

  async function handleMarkAllAsRead() {
    setMarkingAll(true);
    const result = await markAllNotificationsReadAction();

    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date() }))
      );
      setUnreadCount(0);
      router.refresh();
    }

    setMarkingAll(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const result = await deleteNotificationsAction(ids);

    if (result.success) {
      const deletedUnread = notifications.filter(
        (n) => ids.includes(n.id) && !n.readAt
      ).length;
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setUnreadCount((prev) => Math.max(0, prev - deletedUnread));
      setTotalCount((prev) => prev - ids.length);
      setSelectedIds(new Set());
      router.refresh();
    }

    setDeleting(false);
    setShowDeleteDialog(false);
  }

  function resolveLocalizedText(
    key: string,
    data: Record<string, unknown> | null
  ): string {
    // key format: notification.types.orgJoinedParent.title
    // We need to extract the part after "notification.types."
    const typeKey = key.replace('notification.types.', '');
    const parts = typeKey.split('.');

    if (parts.length === 2) {
      const [typeName, field] = parts;

      try {
        // Pass data values directly to next-intl for ICU interpolation
        const values = data
          ? Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
            )
          : {};

        return tTypes(`${typeName}.${field}` as any, values);
      } catch {
        return key;
      }
    }

    return key;
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <BellIcon className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-4">{t('empty')}</p>
      </div>
    );
  }

  const allSelected = selectedIds.size === notifications.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-4">
      {/* Header: select-all, unread badge, actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleSelectAll}
          aria-label={allSelected ? t('deselectAll') : t('selectAll')}
        />
        <button
          onClick={toggleSelectAll}
          className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400"
        >
          {allSelected ? t('deselectAll') : t('selectAll')}
        </button>

        {unreadCount > 0 && (
          <Badge color="blue">
            {unreadCount} {t('unread')}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button color="red" onClick={() => setShowDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4" />
              {t('deleteSelected')} ({selectedIds.size})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button plain onClick={handleMarkAllAsRead} disabled={markingAll}>
              {t('markAllRead')}
            </Button>
          )}
        </div>
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="h-[70vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const notification = notifications[virtualRow.index];
            const isUnread = !notification.readAt;
            const isSelected = selectedIds.has(notification.id);

            return (
              <div
                key={notification.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`flex items-start gap-3 border-b border-zinc-200 p-4 dark:border-zinc-700 ${
                    isUnread ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  } ${isSelected ? 'bg-blue-100/60 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(notification.id)}
                      aria-label={`Select notification ${notification.id}`}
                    />
                  </div>

                  <div className="mt-0.5 flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm ${
                            isUnread
                              ? 'font-semibold text-zinc-900 dark:text-white'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {resolveLocalizedText(
                            notification.title,
                            notification.data
                          )}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                          {resolveLocalizedText(
                            notification.body,
                            notification.data
                          )}
                        </p>
                      </div>

                      {isUnread && (
                        <div className="flex-shrink-0">
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <time className="text-xs text-zinc-400 dark:text-zinc-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </time>
                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={loadingId === notification.id}
                          className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {t('markRead')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loadingMore && (
          <div className="py-4 text-center text-sm text-zinc-500">
            {t('loadMore')}...
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onClose={setShowDeleteDialog} size="sm">
        <DialogTitle>
          {t('confirmDelete', { count: selectedIds.size })}
        </DialogTitle>
        <DialogDescription>{t('confirmDeleteDescription')}</DialogDescription>
        <DialogActions>
          <Button
            plain
            onClick={() => setShowDeleteDialog(false)}
            disabled={deleting}
          >
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleDelete} disabled={deleting}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
