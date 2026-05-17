'use client';

import { useTranslations } from 'next-intl';
import {
  ReportVisibility,
  ALL_REPORT_VISIBILITIES,
} from '@/domain/report/ReportVisibility';
import { BoardsMultiPicker } from './BoardsMultiPicker';

interface VisibilityPickerProps {
  value: ReportVisibility;
  onChange: (next: ReportVisibility) => void;
  orgBoards: Array<{ id: string; name: string }>;
  selectedBoardIds: string[];
  onBoardsChange: (next: string[]) => void;
}

const VISIBILITY_KEY: Record<ReportVisibility, string> = {
  PUBLIC_ANON: 'publicAnon',
  PUBLIC_AUTH: 'publicAuth',
  WITHIN_ORG_ONLY: 'withinOrgOnly',
  WITHIN_ORG_ANCESTORS: 'withinOrgAncestors',
  WITHIN_ORG_DESCENDANTS: 'withinOrgDescendants',
  WITHIN_ORG_TREE: 'withinOrgTree',
  WITHIN_BOARDS: 'withinBoards',
};

export function VisibilityPicker({
  value,
  onChange,
  orgBoards,
  selectedBoardIds,
  onBoardsChange,
}: VisibilityPickerProps) {
  const t = useTranslations('report.visibility');

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-950 dark:text-white">
        {t('label')}
      </legend>
      <div className="space-y-2">
        {ALL_REPORT_VISIBILITIES.map((v) => (
          <div key={v}>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={value === v}
                onChange={() => onChange(v)}
                className="h-4 w-4 border-zinc-300 accent-zinc-900 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-800 dark:text-zinc-200">
                {t(VISIBILITY_KEY[v] as Parameters<typeof t>[0])}
              </span>
            </label>
            {v === ReportVisibility.WITHIN_BOARDS &&
              value === ReportVisibility.WITHIN_BOARDS && (
                <div className="ml-7 mt-2">
                  <BoardsMultiPicker
                    boards={orgBoards}
                    selected={selectedBoardIds}
                    onChange={onBoardsChange}
                  />
                </div>
              )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
