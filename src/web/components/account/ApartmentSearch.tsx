'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/src/web/components/catalyst/input';

interface FlatSuggestion {
  label: string;
  flat: string;
  oneLine: string;
  flatFiasId?: string;
}

type Props = {
  value: string;
  houseLabel: string;
  // The actual capability signal — see search() below. Required (not
  // optional) so every call site must pass it explicitly, string not
  // `string | undefined`, so '' and "absent" are the same falsy value.
  houseFiasId: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (flat: string, flatFiasId: string) => void;
};

export function ApartmentSearch({
  value,
  houseLabel,
  houseFiasId,
  invalid,
  disabled,
  onChange,
}: Props) {
  const [results, setResults] = useState<FlatSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (fragment: string) => {
      // houseFiasId — not houseLabel — is the signal that flats can be
      // probed at all: only DaData house-level hits carry one. oneLine (and
      // therefore houseLabel) is set for Nominatim picks too, so gating on
      // houseLabel alone would fire a query DaData can never answer and
      // burn a quota slot for nothing.
      if (!houseLabel || !houseFiasId) {
        return;
      }

      try {
        const res = await fetch('/api/address/flats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ houseLabel, fragment }),
        });

        if (res.ok) {
          const { flats } = (await res.json()) as { flats: FlatSuggestion[] };
          setResults(flats);
          setShowDropdown(flats.length > 0);
        }
      } catch {
        // Silently fail — the field stays free-text
      }
    },
    [houseLabel, houseFiasId]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    // Typing by hand invalidates any previously picked ГАР flat id
    onChange(next, '');

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => search(next), 300);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        name="apartment"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        invalid={invalid}
      />
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.map((result) => (
            <li key={result.oneLine}>
              <button
                type="button"
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => {
                  onChange(result.flat, result.flatFiasId ?? '');
                  setShowDropdown(false);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
