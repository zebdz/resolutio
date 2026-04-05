'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { leaveBoardAction } from '@/src/web/actions/board/board';

interface LeaveBoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  board: { id: string; name: string };
}

export function LeaveBoardDialog({
  isOpen,
  onClose,
  board,
}: LeaveBoardDialogProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('boardId', board.id);

    const result = await leaveBoardAction(formData);

    if (result.success) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('leaveBoardConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('leaveBoardConfirmDescription', { boardName: board.name })}
      </DialogDescription>
      <DialogBody>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={handleClose} disabled={isLoading}>
          {tCommon('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? t('leaving') : t('leaveBoard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
