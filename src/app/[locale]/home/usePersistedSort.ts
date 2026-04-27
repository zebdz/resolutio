'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadSort, saveSort, type SortState } from './sortStorage';

export function usePersistedSort<F extends string>(
  storageKey: string,
  allowedFields: readonly F[],
  defaultValue: SortState<F>
): [SortState<F>, (next: SortState<F>) => void] {
  const [value, setValue] = useState<SortState<F>>(defaultValue);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setValue(
      loadSort(window.localStorage, storageKey, allowedFields, defaultValue)
    );
    // We intentionally hydrate only once on mount — storageKey, allowedFields,
    // and defaultValue are stable per usage site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (next: SortState<F>) => {
      setValue(next);

      if (typeof window !== 'undefined') {
        saveSort(window.localStorage, storageKey, next);
      }
    },
    [storageKey]
  );

  return [value, update];
}
