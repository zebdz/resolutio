'use client';

import { useTranslations } from 'next-intl';

interface Props {
  distributionType: string;
  propertyAggregation: string;
  scopedPropertyNames: string[];
  showAggregation: boolean;
}

export function WeightConfigLabel({
  distributionType,
  propertyAggregation,
  scopedPropertyNames,
  showAggregation,
}: Props) {
  const tType = useTranslations('poll.distribution.type');
  const tResults = useTranslations('poll.results');
  const tAgg = useTranslations('poll.aggregation');

  const typeLabel =
    distributionType === 'EQUAL'
      ? tType('equal')
      : distributionType === 'OWNERSHIP_UNIT_COUNT'
        ? tType('ownershipUnitCount')
        : tType('ownershipSizeWeighted');

  return (
    <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      <p>{tResults('distributionTypeLabel', { type: typeLabel })}</p>
      {scopedPropertyNames.length > 0 && (
        <p>
          {tResults('propertiesLabel', {
            names: scopedPropertyNames.join(', '),
          })}
        </p>
      )}
      {showAggregation && (
        <p>
          {tResults('aggregationLabel', {
            aggregation:
              propertyAggregation === 'RAW_SUM'
                ? tAgg('rawSum')
                : tAgg('normalizePerProperty'),
          })}
        </p>
      )}
    </div>
  );
}
