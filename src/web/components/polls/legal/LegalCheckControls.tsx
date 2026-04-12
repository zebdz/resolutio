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
  onCheckLegality: (model: string) => void;
}

export function LegalCheckControls({
  isAnalyzing,
  hasUnsavedChanges,
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
          disabled={isAnalyzing}
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
        disabled={isAnalyzing || hasUnsavedChanges}
      >
        <ShieldCheckIcon data-slot="icon" />
        {isAnalyzing
          ? t('analyzing')
          : hasUnsavedChanges
            ? t('saveFirst')
            : t('checkLegality')}
      </Button>
    </div>
  );
}
