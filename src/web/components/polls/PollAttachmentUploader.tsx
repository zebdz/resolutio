'use client';

import { AttachmentPreview } from './AttachmentPreview';
import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import {
  POLL_ATTACHMENT_ALLOWED_MIME_TYPES,
  POLL_ATTACHMENT_COUNT_LIMIT,
  QUESTION_ATTACHMENT_COUNT_LIMIT,
} from '@/domain/poll/PollAttachment';
import type { PollAttachmentSummary } from '@/web/actions/poll/pollAttachments';

interface Props {
  question?: boolean;
  attachments: PollAttachmentSummary[];
  uploading: boolean;
  /** Id currently being removed, so only that row shows a pending state. */
  removingId: string | null;
  /** Already-localized upload or removal failure. */
  error?: string | null;
  /** True while the poll is frozen — attachments cannot change once voting opens. */
  disabled?: boolean;
  onPickFile: (file: File) => Promise<void>;
  onRemove: (id: string) => void;
}

function formatSize(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);

  return mb >= 0.1
    ? `${mb.toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;
}

/**
 * Attach a file to a question or poll description. Each owner has its own limit.
 *
 * Paste and drag-and-drop already work inside the editor, but neither is
 * discoverable — this control makes them discoverable. Description uploads insert the markdown ref for the
 * author, so they never have to write one by hand.
 */
export function PollAttachmentUploader({
  attachments,
  question = false,
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

  const [pending, setPending] = useState<File | null>(null);
  const limit = question
    ? QUESTION_ATTACHMENT_COUNT_LIMIT
    : POLL_ATTACHMENT_COUNT_LIMIT;
  const atLimit = attachments.length >= limit;

  return (
    <div className="mt-3 space-y-2">
      {question && <p className="text-sm font-medium">{t('questionLabel')}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={POLL_ATTACHMENT_ALLOWED_MIME_TYPES.join(',')}
        onChange={async (e) => {
          const file = e.target.files?.[0];

          // Reset so picking the same file twice still fires onChange.
          e.target.value = '';

          if (!file) {
            return;
          }

          if (question) {
            setPending(file);
          }

          try {
            await onPickFile(file);
          } finally {
            if (question) {
              setPending(null);
            }
          }
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
          {attachments.length}/{limit}
        </span>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t(question ? 'questionHint' : 'hint')}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {question && pending && (
        <div className="flex items-center gap-3 text-sm">
          <AttachmentPreview
            source={pending}
            name={pending.name}
            mimeType={pending.type}
          />
          <span className="break-all">{pending.name}</span>
        </div>
      )}
      {attachments.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              {question && (
                <AttachmentPreview
                  source={'/api/poll-attachments/' + a.id}
                  name={a.fileName}
                  mimeType={a.mimeType}
                />
              )}
              <a
                href={'/api/poll-attachments/' + a.id}
                className="min-w-0 flex-1 cursor-pointer truncate text-sm text-zinc-700 underline dark:text-zinc-300"
              >
                {a.fileName}
              </a>
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
