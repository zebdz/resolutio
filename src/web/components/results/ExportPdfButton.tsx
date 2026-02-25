'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/app/components/catalyst/button';

interface ExportPdfButtonProps {
  pollId: string;
}

export default function ExportPdfButton({ pollId }: ExportPdfButtonProps) {
  const t = useTranslations('poll.results.pdf');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/polls/${pollId}/results/pdf?locale=${locale}`
      );

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] ?? 'results.pdf';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      color="zinc"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? t('exporting') : t('exportPdf')}
    </Button>
  );
}
