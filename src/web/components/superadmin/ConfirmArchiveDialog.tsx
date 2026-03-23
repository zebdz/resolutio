'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';

interface ConfirmArchiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationName: string;
  action: 'archive' | 'unarchive';
  onConfirm: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function ConfirmArchiveDialog({
  isOpen,
  onClose,
  organizationName,
  action,
  onConfirm,
  isLoading,
  error,
}: ConfirmArchiveDialogProps) {
  const t = useTranslations('superadmin.organizations');

  const isArchive = action === 'archive';

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>
        {isArchive ? t('archiveDialogTitle') : t('unarchiveDialogTitle')}
      </DialogTitle>
      <DialogDescription>
        {isArchive
          ? t('archiveDialogDescription', { name: organizationName })
          : t('unarchiveDialogDescription', { name: organizationName })}
      </DialogDescription>
      <DialogBody>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button
          color={isArchive ? 'red' : 'brand-green'}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading
            ? isArchive
              ? t('archiving')
              : t('unarchiving')
            : isArchive
              ? t('archiveButton')
              : t('unarchiveButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
