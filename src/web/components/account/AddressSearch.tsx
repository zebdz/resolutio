'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/src/web/components/catalyst/input';

interface AddressSuggestion {
  label: string;
  oneLine: string;
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  postalCode: string;
  houseFiasId?: string;
}

export interface AddressFields {
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
  isPrivateHouse: boolean;
  oneLine: string;
  houseFiasId: string;
  flatFiasId: string;
}

type Props = {
  onSelect: (fields: AddressFields, houseLabel: string) => void;
  disabled?: boolean;
};

export function AddressSearch({ onSelect, disabled }: Props) {
  const t = useTranslations('account');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, AddressSuggestion[]>>(new Map());

  const search = useCallback(async (q: string) => {
    const key = q.trim();

    if (key.length < 3) {
      setResults([]);
      setShowDropdown(false);

      return;
    }

    // Typing "Ростов" then backspacing to "Росто" must not re-hit the API —
    // each call costs one middleware session hit out of 120/min
    const cached = cacheRef.current.get(key);

    if (cached) {
      setResults(cached);
      setShowDropdown(cached.length > 0);

      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch('/api/address/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: key }),
      });

      if (res.ok) {
        const { suggestions } = (await res.json()) as {
          suggestions: AddressSuggestion[];
        };
        cacheRef.current.set(key, suggestions);
        setResults(suggestions);
        setShowDropdown(suggestions.length > 0);
      }
    } catch {
      // Silently fail — user can fill manually
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(value);
    }, 300);
  }

  function handleSelect(result: AddressSuggestion) {
    onSelect(
      {
        country: result.country,
        region: result.region,
        city: result.city,
        street: result.street,
        building: result.building,
        // Reset — a new building invalidates any previously entered flat.
        // This also fixes the stale-apartment carry-over bug.
        apartment: '',
        postalCode: result.postalCode,
        isPrivateHouse: false,
        oneLine: result.oneLine,
        houseFiasId: result.houseFiasId ?? '',
        flatFiasId: '',
      },
      result.label
    );
    setQuery(result.label);
    setShowDropdown(false);
  }

  // Close dropdown on outside click
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

  // Cleanup debounce on unmount
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
        value={query}
        onChange={handleInputChange}
        placeholder={t('addressSearchPlaceholder')}
        disabled={disabled}
      />
      {isSearching && (
        <p className="mt-1 text-sm text-zinc-500">{t('addressSearching')}</p>
      )}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.map((result, index) => (
            // oneLine is blank for every Nominatim row (see
            // NominatimAddressProvider) and would collide as a key, so pair
            // the label with its position instead.
            <li key={`${result.label}-${index}`}>
              <button
                type="button"
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => handleSelect(result)}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showDropdown &&
        results.length === 0 &&
        !isSearching &&
        query.length >= 3 && (
          <p className="mt-1 text-sm text-zinc-500">{t('addressNoResults')}</p>
        )}
    </div>
  );
}
