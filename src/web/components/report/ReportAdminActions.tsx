'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/src/i18n/routing';
import { toast } from 'sonner';
import { Button } from '@/web/components/catalyst/button';
import {
  publishReportAction,
  downgradeReportToDraftAction,
  archiveReportAction,
} from '@/web/actions/report/report';

interface Props {
  report: { id: string; state: 'DRAFT' | 'PUBLISHED' };
  canPublish: boolean;
  canEdit: boolean;
}

export function ReportAdminActions({ report, canPublish, canEdit }: Props) {
  const t = useTranslations('report.detail');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [notifyAudience, setNotifyAudience] = useState(false);

  async function handlePublish() {
    setSubmitting(true);
    const r = await publishReportAction({
      reportId: report.id,
      notifyAudience,
    });

    if (!r.success) {
      toast.error(r.error);
    } else {
      toast.success(t('publishButton'));
      router.refresh();
    }

    setSubmitting(false);
  }

  async function handleDowngrade() {
    setSubmitting(true);
    const r = await downgradeReportToDraftAction({ reportId: report.id });

    if (!r.success) {
      toast.error(r.error);
    } else {
      toast.success(t('downgradeButton'));
      router.refresh();
    }

    setSubmitting(false);
  }

  async function handleArchive() {
    if (!window.confirm(t('archiveConfirm'))) {
      return;
    }

    setSubmitting(true);
    const r = await archiveReportAction({ reportId: report.id });

    if (!r.success) {
      toast.error(r.error);
    } else {
      toast.success(t('archiveButton'));
      router.refresh();
    }

    setSubmitting(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {report.state === 'DRAFT' && canPublish && (
        <>
          <Button
            type="button"
            color="brand-green"
            disabled={submitting}
            onClick={handlePublish}
            className="disabled:cursor-not-allowed"
          >
            {t('publishButton')}
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={notifyAudience}
              onChange={(e) => setNotifyAudience(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 disabled:cursor-not-allowed dark:border-zinc-600"
            />
            {t('notifyAudience')}
          </label>
        </>
      )}

      {report.state === 'PUBLISHED' && canEdit && (
        <Button
          type="button"
          color="zinc"
          disabled={submitting}
          onClick={handleDowngrade}
          className="disabled:cursor-not-allowed"
        >
          {t('downgradeButton')}
        </Button>
      )}

      {canEdit && (
        <Button
          type="button"
          color="red"
          disabled={submitting}
          onClick={handleArchive}
          className="disabled:cursor-not-allowed"
        >
          {t('archiveButton')}
        </Button>
      )}
    </div>
  );
}
