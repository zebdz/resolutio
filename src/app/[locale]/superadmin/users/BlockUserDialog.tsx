'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';

interface BlockResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

interface BlockUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  initialReason?: string;
  onConfirm: (reason: string) => Promise<BlockResult>;
}

export function BlockUserDialog({
  isOpen,
  onClose,
  userName,
  initialReason = '',
  onConfirm,
}: BlockUserDialogProps) {
  const t = useTranslations('superadmin.users');
  const [reason, setReason] = useState(initialReason);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onConfirm(reason);

      if (result.success) {
        setReason('');
      } else if (result.fieldErrors?.reason) {
        setError(result.fieldErrors.reason[0]);
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(t('blockFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setReason(initialReason);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('blockConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('blockConfirmDescription', { name: userName })}
      </DialogDescription>
      <DialogBody>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('reasonLabel')}</label>
          <Textarea
            value={reason}
            invalid={!!error}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder={t('reasonPlaceholder')}
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
        <Button plain onClick={handleClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {t('confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
