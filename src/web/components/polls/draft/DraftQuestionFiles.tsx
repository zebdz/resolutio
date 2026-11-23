'use client';

/** Select question documents before the draft has a server ID. The parent owns
 * the selected bytes so changing questions or correcting validation preserves them. */
import { useTranslations } from 'next-intl';
import {
  POLL_ATTACHMENT_ALLOWED_MIME_TYPES,
  QUESTION_ATTACHMENT_COUNT_LIMIT,
} from '@/domain/poll/PollAttachment';
import { AttachmentPreview } from '../AttachmentPreview';
import { Button } from '@/web/components/catalyst/button';

export function DraftQuestionFiles({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations('poll.attachments');

  return (
    <div className="space-y-2">
      <label className="block space-y-2 text-sm">
        <span className="font-medium">{t('questionLabel')}</span>
        <input
          type="file"
          disabled={disabled || files.length >= QUESTION_ATTACHMENT_COUNT_LIMIT}
          accept={POLL_ATTACHMENT_ALLOWED_MIME_TYPES.join(',')}
          className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-400 file:px-3 file:py-1.5 disabled:cursor-not-allowed"
          onChange={(event) => {
            const selected = event.target.files?.[0];

            if (selected && files.length < QUESTION_ATTACHMENT_COUNT_LIMIT) {
              onChange([...files, selected]);
            }

            event.target.value = '';
          }}
        />
      </label>
      <p className="text-xs text-zinc-500">
        {t('draftQuestionHint', {
          count: files.length,
          limit: QUESTION_ATTACHMENT_COUNT_LIMIT,
        })}
      </p>
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <AttachmentPreview
            source={file}
            name={file.name}
            mimeType={file.type}
          />
          <span className="min-w-0 flex-1 break-all">{file.name}</span>
          <Button
            type="button"
            plain
            disabled={disabled}
            onClick={() => onChange(files.filter((_, i) => i !== index))}
          >
            {t('remove')}
          </Button>
        </div>
      ))}
    </div>
  );
}
