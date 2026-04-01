'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/src/web/components/catalyst/input';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
    suburb?: string;
    county?: string;
  };
}

export interface AddressFields {
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
}

type Props = {
  locale: string;
  onSelect: (fields: Partial<AddressFields>) => void;
  disabled?: boolean;
};

export function AddressSearch({ locale, onSelect, disabled }: Props) {
  const t = useTranslations('account');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 3) {
        setResults([]);
        setShowDropdown(false);

        return;
      }

      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          q,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
        });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            headers: {
              'Accept-Language': locale,
            },
          }
        );

        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // Silently fail — user can fill manually
      } finally {
        setIsSearching(false);
      }
    },
    [locale]
  );

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

  function handleSelect(result: NominatimResult) {
    const addr = result.address;
    onSelect({
      country: addr.country || '',
      region: addr.state || '',
      city: addr.city || addr.town || addr.village || '',
      street: addr.road || '',
      building: addr.house_number || '',
      postalCode: addr.postcode || '',
    });
    setQuery(result.display_name);
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
          {results.map((result) => (
            <li key={result.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => handleSelect(result)}
              >
                {result.display_name}
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
