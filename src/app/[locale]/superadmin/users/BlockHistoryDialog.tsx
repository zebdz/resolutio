'use client';

import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { User } from '@/domain/user/User';

interface HistoryEntry {
  id: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  statusChangedBy: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
  };
}

interface BlockHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: HistoryEntry[];
  emptyLabel: string;
  blockedLabel: string;
  unblockedLabel: string;
  changedByLabel: string;
  closeLabel: string;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

export function BlockHistoryDialog({
  isOpen,
  onClose,
  title,
  entries,
  emptyLabel,
  blockedLabel,
  unblockedLabel,
  changedByLabel,
  closeLabel,
}: BlockHistoryDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogBody>
        {entries.length === 0 ? (
          <Text className="text-sm text-zinc-500">{emptyLabel}</Text>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500">
                    {formatDateTime(entry.createdAt)}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      entry.status === 'blocked'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {entry.status === 'blocked' ? blockedLabel : unblockedLabel}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {changedByLabel.replace(
                      '{name}',
                      User.formatFullName(
                        entry.statusChangedBy.firstName,
                        entry.statusChangedBy.lastName,
                        entry.statusChangedBy.middleName
                      )
                    )}
                  </span>
                </div>
                {entry.reason && (
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {entry.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {closeLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
