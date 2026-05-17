'use client';

import { useTranslations } from 'next-intl';
import { ReportVisibility } from '@/domain/report/ReportVisibility';
import { canAttachPollToReportShape } from './canAttachPollToReportShape';

interface PollItem {
  id: string;
  title: string;
  organizationId: string;
  boardId: string | null;
  archivedAt: string | null;
}

interface ReportShape {
  visibility: ReportVisibility;
  organizationId: string;
  boardIds: string[];
}

interface PollPickerProps {
  polls: PollItem[];
  reportShape: ReportShape;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function PollPicker({
  polls,
  reportShape,
  selected,
  onChange,
}: PollPickerProps) {
  const t = useTranslations('report.polls');

  const attachable = polls.filter((p) =>
    canAttachPollToReportShape(p, reportShape)
  );
  const attachableIds = new Set(attachable.map((p) => p.id));

  const visiblePolls = polls.filter(
    (p) => attachableIds.has(p.id) || selected.includes(p.id)
  );

  const noneAttachable = attachable.length === 0 && selected.length === 0;

  function toggle(pollId: string) {
    if (selected.includes(pollId)) {
      onChange(selected.filter((id) => id !== pollId));
    } else {
      onChange([...selected, pollId]);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-950 dark:text-white">
        {t('label')}
      </legend>

      {noneAttachable ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('noneAttachable')}
        </p>
      ) : (
        <div className="space-y-2">
          {visiblePolls.map((poll) => {
            const isSelected = selected.includes(poll.id);
            const isAttachable = attachableIds.has(poll.id);
            const isArchived = poll.archivedAt !== null;
            const isNoLongerAttachable = isSelected && !isAttachable;

            const label = [
              poll.title,
              isArchived ? t('archivedSuffix') : '',
              isNoLongerAttachable ? t('noLongerAttachable') : '',
            ].join('');

            return (
              <label
                key={poll.id}
                className="flex cursor-pointer items-center gap-3"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!isSelected && !isAttachable}
                  onChange={() => toggle(poll.id)}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 disabled:cursor-not-allowed dark:border-zinc-600"
                />
                <span
                  className={[
                    'text-sm',
                    isNoLongerAttachable
                      ? 'line-through text-zinc-400 dark:text-zinc-500'
                      : 'text-zinc-800 dark:text-zinc-200',
                  ].join(' ')}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
