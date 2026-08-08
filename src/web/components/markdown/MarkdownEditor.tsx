'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { buildAttachmentRef } from './buildAttachmentRef';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((m) => m.default),
  { ssr: false }
);

interface Props {
  value: string;
  onChange: (next: string) => void;
  /**
   * Attachment API path prefix for the owning aggregate, e.g.
   * `/api/poll-attachments` or `/api/report-attachments`. Inserted refs point
   * at this prefix.
   */
  apiPrefix: string;
  onUploadAttachment?: (
    file: File
  ) => Promise<{ id: string } | { error: string }>;
  maxLength?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  apiPrefix,
  onUploadAttachment,
  maxLength,
}: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  const insertAttachment = async (file: File) => {
    if (!onUploadAttachment) {
      return;
    }

    const r = await onUploadAttachment(file);

    if ('id' in r) {
      onChange(
        value +
          buildAttachmentRef({
            fileName: file.name,
            mimeType: file.type,
            apiPrefix,
            id: r.id,
          })
      );
    }
  };

  return (
    <div data-color-mode={theme} className="w-full">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={420}
        previewOptions={{ skipHtml: true }}
        textareaProps={{ maxLength }}
        onPaste={async (e) => {
          const file = e.clipboardData?.files?.[0];

          if (file && onUploadAttachment) {
            e.preventDefault();
            await insertAttachment(file);
          }
        }}
        onDrop={async (e) => {
          const file = e.dataTransfer?.files?.[0];

          if (file && onUploadAttachment) {
            e.preventDefault();
            await insertAttachment(file);
          }
        }}
      />
    </div>
  );
}
