'use client';

/** Presents supported aggregation choices while preserving the domain's closed vocabulary. */
import {
  parsePropertyAggregation,
  type PropertyAggregation,
} from '@/domain/poll/PropertyAggregation';
import { useTranslations } from 'next-intl';
import {
  Radio,
  RadioField,
  RadioGroup,
} from '@/src/web/components/catalyst/radio';
import { Label } from '@/src/web/components/catalyst/fieldset';

interface Props {
  value: PropertyAggregation;
  onChange: (v: PropertyAggregation) => void;
  disabled?: boolean;
  visible: boolean;
}

export function PropertyAggregationSelector({
  value,
  onChange,
  disabled,
  visible,
}: Props) {
  const t = useTranslations('poll.aggregation');

  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white">
          {t('label')}
        </span>
        <span
          className="inline-flex cursor-help text-zinc-400"
          title={t('tooltip')}
          aria-label={t('tooltip')}
        >
          <svg
            className="size-4"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 11V8M8 5h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
      <RadioGroup
        value={value}
        onChange={(value: unknown) => {
          if (typeof value !== 'string') {
            return;
          }

          const selected = parsePropertyAggregation(value);

          if (selected.success) {
            onChange(selected.value);
          }
        }}
        disabled={disabled}
      >
        <RadioField>
          <Radio value="RAW_SUM" />
          <Label>{t('rawSum')}</Label>
        </RadioField>
        <RadioField>
          <Radio value="NORMALIZE_PER_PROPERTY" />
          <Label>{t('normalizePerProperty')}</Label>
        </RadioField>
      </RadioGroup>
    </div>
  );
}
