'use client';

// Search-and-pick input for org-tree members. Replaces the old "type a userId
// cuid" UX and the 200-row Select with a typeahead that hits the server. Used
// in EditOwnersModal but generic enough for other property-admin pickers.
//
// Props:
//   - organizationId — root org for the tree-aware member search
//   - value — current selected userId (may be empty)
//   - onChange — called with the new userId
//   - initialLabel — display label for the current value when first mounted
//     (e.g., "Иванов Иван (@ivanov)"). Optional. If omitted and `value` is
//     non-empty, the cuid is shown until the user opens the picker once.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/src/web/components/catalyst/input';
import { Button } from '@/src/web/components/catalyst/button';
import { searchOrgTreeMembersAction } from '@/src/web/actions/organization/property';

interface Match {
  id: string;
  label: string;
  orgNames: string[];
}

const SEARCH_DEBOUNCE_MS = 250;

export function MemberSearchInput({
  organizationId,
  value,
  onChange,
  initialLabel,
  disabled,
  excludeUserIds,
}: {
  organizationId: string;
  value: string;
  // Receives the picked userId AND its display label (so the parent can
  // persist the label across re-renders without re-fetching).
  onChange: (userId: string, label?: string) => void;
  initialLabel?: string;
  disabled?: boolean;
  // User ids to hide from search results (e.g., already selected in other
  // rows of the same batch). The current row's own userId should NOT be in
  // this list — the user should still see themselves as the picked value.
  excludeUserIds?: string[];
}) {
  const t = useTranslations('propertyAdmin.memberSearch');

  // Display label for the current selection — kept locally so we don't refetch
  // the user's name every render. Set when the user picks from the dropdown,
  // or seeded from `initialLabel`.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(
    initialLabel ?? null
  );
  const [editing, setEditing] = useState(value === '');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced fetch.
  useEffect(() => {
    if (!editing) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        // Fetch a larger page so that client-side exclusion of already-picked
        // users still leaves enough matches to choose from.
        const r = await searchOrgTreeMembersAction({
          organizationId,
          query,
          limit: 40,
        });

        if (r.success) {
          const excluded = new Set(excludeUserIds ?? []);
          setMatches(
            r.data.matches.filter((m) => !excluded.has(m.id)).slice(0, 20)
          );
          setOpen(true);
        }
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, organizationId, editing, excludeUserIds]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocClick);

    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(m: Match) {
    onChange(m.id, m.label);
    setSelectedLabel(m.label);
    setEditing(false);
    setOpen(false);
    setQuery('');
  }

  function changeSelection() {
    setEditing(true);
    setQuery('');
    setOpen(true);
  }

  // Already-selected display — show name + Change button.
  if (!editing && value) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
          {selectedLabel ?? value}
        </div>
        <Button plain onClick={changeSelection} disabled={disabled}>
          {t('change')}
        </Button>
      </div>
    );
  }

  // Search-and-pick UI.
  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={t('placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        disabled={disabled}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {pending && (
            <div className="px-3 py-2 text-xs text-zinc-500">
              {t('loading')}
            </div>
          )}
          {!pending && matches.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">
              {query.trim() ? t('noResults') : t('typeToSearch')}
            </div>
          )}
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => pick(m)}
            >
              <div className="text-zinc-900 dark:text-zinc-100">{m.label}</div>
              <div className="text-xs text-zinc-500">
                {m.orgNames.join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
