'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/src/web/components/catalyst/button';
import { Select } from '@/src/web/components/catalyst/select';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { AI_MODELS } from '@/application/ai/modelRegistry';

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
  const [model, setModel] = useState<string>(AI_MODELS[0].key);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field className="sm:w-44">
        <Label className="text-sm">{t('selectModel')}</Label>
        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isAnalyzing || !canRun}
        >
          {AI_MODELS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.displayName}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        color="amber"
        onClick={() => onCheckLegality(model)}
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
