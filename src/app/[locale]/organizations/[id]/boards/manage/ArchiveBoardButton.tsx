'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { archiveBoardAction } from '@/web/actions/board';

type ArchiveBoardButtonProps = {
  boardId: string;
  boardName: string;
};

export default function ArchiveBoardButton({
  boardId,
  boardName,
}: ArchiveBoardButtonProps) {
  const t = useTranslations('organization.boards.manage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setIsArchiving(true);
    setError(null);

    const result = await archiveBoardAction(boardId);

    if (result.success) {
      setIsOpen(false);
      router.refresh();
    } else {
      setError(result.error);
      setIsArchiving(false);
    }
  };

  return (
    <>
      <Button color="red" onClick={() => setIsOpen(true)}>
        {t('archiveBoard')}
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>{t('archiveBoard')}</DialogTitle>
        <DialogDescription>
          {t('archiveBoardConfirm', { board: boardName })}
        </DialogDescription>
        <DialogBody>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsOpen(false)} disabled={isArchiving}>
            {tCommon('cancel')}
          </Button>
          <Button color="red" onClick={handleArchive} disabled={isArchiving}>
            {isArchiving ? t('archiving') : t('archiveBoard')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
