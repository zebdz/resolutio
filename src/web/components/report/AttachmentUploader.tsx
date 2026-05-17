'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';

interface AttachmentUploaderProps {
  reportId: string;
  onUploaded: (att: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }) => void;
}

export function AttachmentUploader({
  reportId,
  onUploaded,
}: AttachmentUploaderProps) {
  const t = useTranslations('report.attachments');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('reportId', reportId);
      form.append('file', file);

      const res = await fetch('/api/report-attachments', {
        method: 'POST',
        body: form,
      });

      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        onUploaded({
          id,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(t('uploadError', { error: body.error ?? String(res.status) }));
      }
    } catch {
      setError(t('uploadError', { error: 'network error' }));
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        outline
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer disabled:cursor-not-allowed"
      >
        {uploading ? t('uploading') : t('uploadButton')}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
