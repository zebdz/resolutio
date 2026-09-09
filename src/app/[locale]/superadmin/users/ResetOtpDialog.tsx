'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { resetUserOtpAction } from '@/src/web/actions/superadmin/userOtp';

interface ResetOtpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  nickname: string;
}

export function ResetOtpDialog({
  isOpen,
  onClose,
  userId,
  userName,
  nickname,
}: ResetOtpDialogProps) {
  const t = useTranslations('superadmin.users');
  const [deleted, setDeleted] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await resetUserOtpAction({ userId });

      if (result.success) {
        setDeleted(result.data.deleted);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t('resetOtpFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setDeleted(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('resetOtpTitle')}</DialogTitle>
      <DialogDescription>
        {deleted === null
          ? t('resetOtpDescription', { name: userName })
          : t('resetOtpDone', { name: userName, count: deleted })}
      </DialogDescription>
      <DialogBody>
        <div className="space-y-3">
          <Text className="text-sm text-zinc-500">@{nickname}</Text>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose} disabled={isLoading}>
          {deleted === null ? t('cancel') : t('close')}
        </Button>
        {deleted === null && (
          <Button color="red" onClick={handleReset} disabled={isLoading}>
            {isLoading ? t('resettingOtp') : t('resetOtpConfirm')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
