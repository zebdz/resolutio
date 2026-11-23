'use client';

/** Run a poll legality check with the configured model and show its name before submission. */
import { useTranslations } from 'next-intl';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/src/web/components/catalyst/button';
import { LEGAL_CHECK_MODEL } from '@/application/ai/modelRegistry';

interface LegalCheckControlsProps {
  isAnalyzing: boolean;
  hasUnsavedChanges: boolean;
  /**
   * A new analysis is a READY-only operation server-side
   * (AnalyzePollLegalityUseCase). The control still renders in every other
   * state — a stored check is worth reading whenever, and hiding the button
   * outside READY left admins with no sign the feature exists — but the
   * caller explains the disabled state.
   */
  canRun: boolean;
  onCheckLegality: (model: string) => void;
}

export function LegalCheckControls({
  isAnalyzing,
  hasUnsavedChanges,
  canRun,
  onCheckLegality,
}: LegalCheckControlsProps) {
  const t = useTranslations('legalCheck');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="text-sm">
        <div className="text-zinc-500 dark:text-zinc-400">
          {t('selectModel')}
        </div>
        <div className="font-medium">{LEGAL_CHECK_MODEL.displayName}</div>
      </div>
      <Button
        color="amber"
        onClick={() => onCheckLegality(LEGAL_CHECK_MODEL.key)}
        disabled={isAnalyzing || hasUnsavedChanges || !canRun}
      >
        <ShieldCheckIcon data-slot="icon" />
        {isAnalyzing
          ? t('analyzing')
          : hasUnsavedChanges && canRun
            ? t('saveFirst')
            : t('checkLegality')}
      </Button>
    </div>
  );
}
