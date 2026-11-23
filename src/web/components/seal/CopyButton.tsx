'use client';

/** Copies a displayed commitment or receipt code on request and announces clipboard failures. */
import { useState } from 'react';
import { Button } from '@/web/components/catalyst/button';

export function CopyButton({
  value,
  label,
  copiedLabel,
  failedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');
    } catch {
      setFeedback('failed');
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" outline onClick={copy}>
        {label}
      </Button>
      <span role="status" className="text-sm">
        {feedback === 'copied' && copiedLabel}
        {feedback === 'failed' && failedLabel}
      </span>
    </span>
  );
}
