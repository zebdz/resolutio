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
  // Keyed by `${houseFiasId}:${fragment}`, not fragment alone — this
  // component stays mounted across a house change (AddressForm renders it
  // without a `key`), so a bare fragment key would serve one house's cached
  // flats for a different house.
  const cacheRef = useRef<Map<string, FlatSuggestion[]>>(new Map());

  const search = useCallback(
    async (fragment: string) => {
      // houseFiasId — not houseLabel — is the signal that flats can be
      // probed at all: only DaData house-level hits carry one. houseLabel
      // is set for Nominatim picks too (it comes from the suggestion's
      // display label, not from oneLine, which Nominatim leaves blank), so
      // gating on houseLabel alone would fire a query DaData can never
      // answer and burn a quota slot for nothing.
      if (!houseLabel || !houseFiasId) {
        return;
      }

      const key = fragment.trim();

      // AddressForm's probe (handleAddressSelect) already asked for '' right
      // after the house was picked. Re-asking here on every backspace down to
      // empty would waste a slot of the global DaData daily quota on a
      // question already answered. No minimum beyond that — unlike
      // AddressSearch's 3 chars, flat numbers are legitimately 1-2 characters.
      if (!key) {
        setResults([]);
        setShowDropdown(false);

        return;
      }

      const cacheKey = `${houseFiasId}:${key}`;
      // Typing "12" then backspacing to "1" must not re-hit the API — each
      // call costs one slot of the global 9,500/day cap shared by every user.
      const cached = cacheRef.current.get(cacheKey);

      if (cached) {
        setResults(cached);
        setShowDropdown(cached.length > 0);

        return;
      }

      try {
        const res = await fetch('/api/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'flats', houseLabel, fragment: key }),
        });

        if (res.ok) {
          const { flats } = (await res.json()) as { flats: FlatSuggestion[] };
          cacheRef.current.set(cacheKey, flats);
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
