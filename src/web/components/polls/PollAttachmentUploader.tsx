'use client';

import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import {
  POLL_ATTACHMENT_ALLOWED_MIME_TYPES,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from '@/domain/poll/PollAttachment';
import type { PollAttachmentSummary } from '@/web/actions/poll/pollAttachments';

interface Props {
  attachments: PollAttachmentSummary[];
  uploading: boolean;
  /** Id currently being removed, so only that row shows a pending state. */
  removingId: string | null;
  /** Already-localized upload or removal failure. */
  error?: string | null;
  /** True while the poll is frozen — attachments cannot change once voting opens. */
  disabled?: boolean;
  onPickFile: (file: File) => void;
  onRemove: (id: string) => void;
}

function formatSize(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);

  return mb >= 0.1
    ? `${mb.toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;
}

/**
 * Visible way to attach a file to a poll description.
 *
 * Paste and drag-and-drop already work inside the editor, but neither is
 * discoverable — this is the door. Uploading inserts the markdown ref for the
 * author, so they never have to write one by hand.
 */
export function PollAttachmentUploader({
  attachments,
  uploading,
  removingId,
  error,
  disabled = false,
  onPickFile,
  onRemove,
}: Props) {
  const t = useTranslations('poll.attachments');
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = attachments.length >= POLL_ATTACHMENT_COUNT_LIMIT;

  return (
    <div className="mt-3 space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={POLL_ATTACHMENT_ALLOWED_MIME_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) {
            onPickFile(file);
          }

          // Reset so picking the same file twice still fires onChange.
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          outline
          disabled={disabled || uploading || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t('uploading') : t('uploadButton')}
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {attachments.length}/{POLL_ATTACHMENT_COUNT_LIMIT}
        </span>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('hint')}</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {attachments.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                {a.fileName}
              </span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {formatSize(a.sizeBytes, locale)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                disabled={disabled || removingId === a.id}
                className="shrink-0 cursor-pointer text-sm text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removingId === a.id ? t('removing') : t('remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
