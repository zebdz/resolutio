'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from '@/web/components/catalyst/dialog';
import { Button } from '@/web/components/catalyst/button';

interface Props {
  open: boolean;
  saving: boolean;
  /** Already-localized message explaining why the draft could not be saved. */
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Shown when an author attaches their first file to a poll that has not been
 * saved yet. An attachment row needs a poll id, so the poll has to exist
 * before the upload can be linked to it.
 *
 * The alternative — forcing every author through a two-step create wizard —
 * would tax the majority who never attach anything, so the draft save is
 * deferred until the moment it is actually required.
 */
export function SaveDraftBeforeAttachModal({
  open,
  saving,
  error,
  onSave,
  onCancel,
}: Props) {
  const t = useTranslations('poll.saveDraftModal');

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogDescription>{t('body')}</DialogDescription>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <DialogActions>
        <Button plain onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
