'use client';

/** Render a question file locally before upload or through its authorized saved URL.
 * The thumbnail opens a keyboard-accessible viewer without navigating out of the poll. */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { PdfPreview } from './PdfPreview';
import { Dialog, DialogTitle } from '@/web/components/catalyst/dialog';
import { Button } from '@/web/components/catalyst/button';
import { POLL_ATTACHMENT_ALLOWED_MIME_TYPES } from '@/domain/poll/PollAttachment';

type Props = { source: File | string; name: string; mimeType: string };

function PreviewImage({
  source,
  name,
  expanded = false,
}: Pick<Props, 'source' | 'name'> & { expanded?: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState<Props['source'] | null>(null);
  const t = useTranslations('poll.attachments');

  useEffect(() => {
    if (typeof source === 'string' || !image.current) {
      return;
    }

    const url = URL.createObjectURL(source);
    image.current.src = url;

    return () => URL.revokeObjectURL(url);
  }, [source]);

  if (failed === source) {
    return expanded ? (
      <p role="status">{t('previewUnavailable')}</p>
    ) : (
      <PhotoIcon aria-hidden className="size-6 text-zinc-500" />
    );
  }

  // Local object URLs and access-controlled downloads are read directly by the browser.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image}
      src={typeof source === 'string' ? source : undefined}
      alt={expanded ? name : ''}
      loading={expanded ? 'eager' : 'lazy'}
      onError={() => setFailed(source)}
      className={
        expanded
          ? 'mx-auto max-h-[74dvh] max-w-full object-contain'
          : 'h-full w-full object-contain'
      }
    />
  );
}

export function AttachmentPreview({ source, name, mimeType }: Props) {
  const t = useTranslations('poll.attachments');
  const [openFile, setOpenFile] = useState<Props['source'] | null>(null);
  const pdf = mimeType === 'application/pdf';

  if (!POLL_ATTACHMENT_ALLOWED_MIME_TYPES.some((type) => type === mimeType)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('previewFile', { name })}
        onClick={() => setOpenFile(source)}
        className="relative flex h-14 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 focus-visible:outline-2 dark:border-zinc-600 dark:bg-zinc-800"
      >
        {pdf ? (
          <>
            <PdfPreview source={source} />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-zinc-900/80 text-center text-[9px] font-semibold leading-3 text-white"
            >
              PDF
            </span>
          </>
        ) : (
          <PreviewImage source={source} name={name} />
        )}
      </button>
      {openFile === source && (
        <Dialog open onClose={() => setOpenFile(null)} size="5xl">
          <DialogTitle className="break-all">{name}</DialogTitle>
          <div className="mt-4">
            {pdf ? (
              <PdfPreview source={source} expanded />
            ) : (
              <PreviewImage source={source} name={name} expanded />
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={() => setOpenFile(null)}>
              {t('closePreview')}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
