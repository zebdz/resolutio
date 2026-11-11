'use client';

/** Presents the domain's distribution choices and decodes native select values. */
import {
  parseDistributionType,
  type DistributionType,
} from '@/domain/poll/DistributionType';
import { useTranslations } from 'next-intl';
import { Select } from '@/src/web/components/catalyst/select';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';

interface Props {
  value: DistributionType;
  onChange: (v: DistributionType) => void;
  disabled?: boolean;
  ownershipDisabledReason?: string | null;
}

export function DistributionTypeSelector({
  value,
  onChange,
  disabled,
  ownershipDisabledReason,
}: Props) {
  const t = useTranslations('poll.distribution');

  return (
    <Field>
      <Label>{t('label')}</Label>
      <Select
        value={value}
        onChange={(e) => {
          const selected = parseDistributionType(e.target.value);

          if (selected.success) {
            onChange(selected.value);
          }
        }}
        disabled={disabled}
      >
        <option value="EQUAL">{t('type.equal')}</option>
        <option
          value="OWNERSHIP_UNIT_COUNT"
          disabled={!!ownershipDisabledReason}
          title={ownershipDisabledReason ?? undefined}
        >
          {t('type.ownershipUnitCount')}
        </option>
        <option
          value="OWNERSHIP_SIZE_WEIGHTED"
          disabled={!!ownershipDisabledReason}
          title={ownershipDisabledReason ?? undefined}
        >
          {t('type.ownershipSizeWeighted')}
        </option>
      </Select>
    </Field>
  );
}
