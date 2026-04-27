'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { DistributionTypeSelector } from './DistributionTypeSelector';
import { PropertyScopeSelector } from './PropertyScopeSelector';
import { PropertyAggregationSelector } from './PropertyAggregationSelector';

interface PreviewData {
  addedParticipants: Array<{ userId: string; newWeight: number }>;
  removedParticipants: Array<{ userId: string }>;
  reweightedParticipants: Array<{
    userId: string;
    oldWeight: number;
    newWeight: number;
  }>;
  totalWeight: number;
}

interface WeightConfigDraft {
  distributionType: string;
  propertyAggregation: string;
  propertyIds: string[];
}

interface DescendantGroup {
  orgId: string;
  orgName: string;
  properties: Array<{ id: string; name: string }>;
}

interface Props {
  pollId: string;
  initialConfig: WeightConfigDraft;
  properties: Array<{ id: string; name: string }>;
  descendantGroups?: DescendantGroup[];
  orgHasOwnershipData: boolean;
  votesCast: boolean;
  // Once the poll is ACTIVE or FINISHED the weight config is locked — the
  // backend rejects edits with WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION. The
  // editor must mirror the gate so admins don't try changes that always fail.
  pollState: string;
  onSaved: () => void;
  previewAction: (args: {
    pollId: string;
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  }) => Promise<
    { success: true; data: PreviewData } | { success: false; error: string }
  >;
  updateAction: (args: {
    pollId: string;
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  }) => Promise<{ success: true } | { success: false; error: string }>;
}

export function WeightConfigEditor(props: Props) {
  const t = useTranslations('poll');
  const [draft, setDraft] = useState<WeightConfigDraft>(props.initialConfig);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDraftDifferent =
    draft.distributionType !== props.initialConfig.distributionType ||
    draft.propertyAggregation !== props.initialConfig.propertyAggregation ||
    JSON.stringify([...draft.propertyIds].sort()) !==
      JSON.stringify([...props.initialConfig.propertyIds].sort());

  const isOwnership =
    draft.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
    draft.distributionType === 'OWNERSHIP_SIZE_WEIGHTED';

  // When no scope is picked, "all properties in the tree" is in play — that
  // includes descendants. Counting only `props.properties` would hide the
  // aggregation control for parent-org polls whose properties live in
  // sub-orgs (the org itself often has zero direct properties).
  const totalTreePropertyCount =
    props.properties.length +
    (props.descendantGroups?.reduce((sum, g) => sum + g.properties.length, 0) ??
      0);
  const effectiveScopeCount =
    draft.propertyIds.length === 0
      ? totalTreePropertyCount
      : draft.propertyIds.length;

  const aggregationVisible = isOwnership && effectiveScopeCount >= 2;

  async function loadPreview(next: WeightConfigDraft) {
    setError(null);
    const r = await props.previewAction({
      pollId: props.pollId,
      distributionType: next.distributionType,
      propertyAggregation: next.propertyAggregation,
      propertyIds: next.propertyIds,
    });

    if (r.success) {
      setPreview(r.data);
    } else {
      setError(r.error);
    }
  }

  function handleChange(next: Partial<WeightConfigDraft>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    startTransition(() => {
      void loadPreview(merged);
    });
  }

  function handleCancel() {
    setDraft(props.initialConfig);
    setPreview(null);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    const r = await props.updateAction({
      pollId: props.pollId,
      distributionType: draft.distributionType,
      propertyAggregation: draft.propertyAggregation,
      propertyIds: draft.propertyIds,
    });

    if (r.success) {
      setPreview(null);
      props.onSaved();
    } else {
      setError(r.error);
    }
  }

  const stateLocked =
    props.pollState === 'ACTIVE' || props.pollState === 'FINISHED';
  const disabled = props.votesCast || stateLocked || isPending;

  return (
    <div className="space-y-4 rounded-md border p-4">
      {stateLocked && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          {t('weightConfig.lockedAfterActivation')}
        </p>
      )}
      <DistributionTypeSelector
        value={
          draft.distributionType as
            | 'EQUAL'
            | 'OWNERSHIP_UNIT_COUNT'
            | 'OWNERSHIP_SIZE_WEIGHTED'
        }
        onChange={(v) => handleChange({ distributionType: v })}
        disabled={disabled}
        ownershipDisabledReason={
          !props.orgHasOwnershipData
            ? t('distribution.ownershipOptionDisabledTooltip')
            : null
        }
      />
      {(props.properties.length >= 2 ||
        (props.descendantGroups?.some((g) => g.properties.length > 0) ??
          false)) && (
        <PropertyScopeSelector
          properties={props.properties}
          descendantGroups={props.descendantGroups}
          selectedIds={draft.propertyIds}
          onChange={(ids) => handleChange({ propertyIds: ids })}
          disabled={disabled}
          mode={draft.distributionType === 'EQUAL' ? 'equal' : 'ownership'}
        />
      )}
      <PropertyAggregationSelector
        value={
          draft.propertyAggregation as 'RAW_SUM' | 'NORMALIZE_PER_PROPERTY'
        }
        onChange={(v) => handleChange({ propertyAggregation: v })}
        disabled={disabled}
        visible={aggregationVisible}
      />
      {isDraftDifferent && preview && (
        <div className="rounded-md bg-zinc-50 p-3 text-sm space-y-1 dark:bg-zinc-800">
          <p>
            {t('weightConfig.preview.added', {
              count: preview.addedParticipants.length,
            })}
          </p>
          <p>
            {t('weightConfig.preview.removed', {
              count: preview.removedParticipants.length,
            })}
          </p>
          <p>
            {t('weightConfig.preview.reweighted', {
              count: preview.reweightedParticipants.length,
            })}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-md bg-indigo-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50 text-sm"
              onClick={() => void handleSave()}
              disabled={disabled}
            >
              {t('weightConfig.preview.save')}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-md border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 text-sm dark:border-zinc-600 dark:text-zinc-300"
              onClick={handleCancel}
              disabled={disabled}
            >
              {t('weightConfig.preview.cancel')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
