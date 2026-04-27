'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from '@/src/web/components/catalyst/checkbox';
import { Label } from '@/src/web/components/catalyst/fieldset';

interface Property {
  id: string;
  name: string;
}

interface DescendantGroup {
  orgId: string;
  orgName: string;
  properties: Property[];
}

interface Props {
  // Direct org's properties — always shown.
  properties: Property[];
  // Descendant orgs' properties — shown behind an "Include sub-organizations"
  // expand button. Only non-empty groups are rendered.
  descendantGroups?: DescendantGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  // Drives helper-text wording. For ownership modes the picker scopes the
  // weight calc; for EQUAL it acts as a voter eligibility filter — same
  // mechanic, very different meaning to the user.
  mode: 'equal' | 'ownership';
}

export function PropertyScopeSelector({
  properties,
  descendantGroups,
  selectedIds,
  onChange,
  disabled,
  mode,
}: Props) {
  const t = useTranslations('poll.propertyScope');
  const nonEmptyGroups = (descendantGroups ?? []).filter(
    (g) => g.properties.length > 0
  );
  // Auto-expand when a descendant property is already selected — otherwise the
  // user wouldn't see what they've picked.
  const hasSelectedDescendant = nonEmptyGroups.some((g) =>
    g.properties.some((p) => selectedIds.includes(p.id))
  );
  const [expanded, setExpanded] = useState(hasSelectedDescendant);

  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter((sid) => sid !== id));
    }
  }

  return (
    <div className="space-y-3">
      <span className="text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white">
        {t('label')}
      </span>
      {selectedIds.length === 0 ? (
        <p className="text-xs text-zinc-500">{t(`${mode}.allByDefault`)}</p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          {t(`${mode}.someSelected`, { count: selectedIds.length })}
        </p>
      )}
      <CheckboxGroup>
        {properties.map((prop) => (
          <CheckboxField key={prop.id}>
            <Checkbox
              checked={selectedIds.includes(prop.id)}
              onChange={(checked) => toggle(prop.id, checked)}
              disabled={disabled}
            />
            <Label>{prop.name}</Label>
          </CheckboxField>
        ))}
      </CheckboxGroup>

      {nonEmptyGroups.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            className="cursor-pointer text-sm text-brand-green underline disabled:cursor-not-allowed"
            onClick={() => setExpanded((x) => !x)}
            disabled={disabled}
          >
            {expanded
              ? t('hideSubOrgs')
              : t('showSubOrgs', { count: nonEmptyGroups.length })}
          </button>
          {expanded && (
            <div className="mt-3 space-y-4">
              {nonEmptyGroups.map((group) => (
                <div
                  key={group.orgId}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-2 text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">
                    {group.orgName}
                  </div>
                  <CheckboxGroup>
                    {group.properties.map((prop) => (
                      <CheckboxField key={prop.id}>
                        <Checkbox
                          checked={selectedIds.includes(prop.id)}
                          onChange={(checked) => toggle(prop.id, checked)}
                          disabled={disabled}
                        />
                        <Label>{prop.name}</Label>
                      </CheckboxField>
                    ))}
                  </CheckboxGroup>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
