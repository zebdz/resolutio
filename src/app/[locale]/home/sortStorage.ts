import type { SortDirection } from './sortOrganizations';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

export function loadSort<F extends string>(
  storage: StorageLike,
  key: string,
  allowedFields: readonly F[],
  defaultValue: SortState<F>
): SortState<F> {
  const raw = storage.getItem(key);

  if (raw === null) {
    return defaultValue;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultValue;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return defaultValue;
  }

  const obj = parsed as Record<string, unknown>;
  const field = obj.field;
  const direction = obj.direction;

  if (typeof field !== 'string' || !allowedFields.includes(field as F)) {
    return defaultValue;
  }

  if (direction !== 'asc' && direction !== 'desc') {
    return defaultValue;
  }

  return { field: field as F, direction };
}

export function saveSort<F extends string>(
  storage: StorageLike,
  key: string,
  value: SortState<F>
): void {
  storage.setItem(key, JSON.stringify(value));
}
