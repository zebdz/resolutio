'use client';

import type { SortDirection } from './sortOrganizations';

interface SortField {
  value: string;
  label: string;
}

interface SortPillsProps {
  fields: SortField[];
  active: { field: string; direction: SortDirection };
  onChange: (next: { field: string; direction: SortDirection }) => void;
  ariaLabel: string;
}

export function SortPills({
  fields,
  active,
  onChange,
  ariaLabel,
}: SortPillsProps) {
  const handleClick = (fieldValue: string) => {
    if (fieldValue === active.field) {
      onChange({
        field: fieldValue,
        direction: active.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onChange({ field: fieldValue, direction: 'asc' });
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {fields.map((field) => {
        const isActive = field.value === active.field;
        const arrow = isActive ? (active.direction === 'asc' ? '↑' : '↓') : '';

        return (
          <button
            key={field.value}
            type="button"
            onClick={() => handleClick(field.value)}
            aria-pressed={isActive}
            className={
              'inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
              (isActive
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800')
            }
          >
            <span>{field.label}</span>
            {isActive && <span aria-hidden="true">{arrow}</span>}
          </button>
        );
      })}
    </div>
  );
}
