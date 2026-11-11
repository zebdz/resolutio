/** RFC 8785 serialization, separate NFC preparation, and strict incoming-byte checks.
 * Strings returned here represent UTF-8 bytes, never formatted display JSON. */
import { requireSeal, SealDomainCodes, SealError } from './SealDomainCodes';
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
const invalid = SealDomainCodes.SEAL_INVALID_CANONICAL;

function text(value: string, normalize: boolean): string {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);

    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      requireSeal(next >= 0xdc00 && next <= 0xdfff, invalid);
    } else {
      requireSeal(unit < 0xdc00 || unit > 0xdfff, invalid);
    }
  }

  return normalize ? value.normalize('NFC') : value;
}

function visit(
  value: unknown,
  normalize: boolean,
  parents = new Set<object>()
): Json {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return text(value, normalize);
  }

  if (typeof value === 'number') {
    requireSeal(Number.isFinite(value), invalid);

    return value;
  }

  requireSeal(typeof value === 'object' && value !== null, invalid);
  requireSeal(!parents.has(value) && parents.size < 256, invalid);
  requireSeal(Object.getOwnPropertySymbols(value).length === 0, invalid);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  requireSeal(
    Object.values(descriptors).every((d) => 'value' in d),
    invalid
  );
  parents.add(value);

  try {
    if (Array.isArray(value)) {
      requireSeal(
        Object.keys(value).length === value.length &&
          Object.getOwnPropertyNames(value).length === value.length + 1,
        invalid
      );

      return Array.from(value, (child) => visit(child, normalize, parents));
    }

    requireSeal(
      Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null,
      invalid
    );
    requireSeal(
      Object.values(descriptors).every((d) => d.enumerable),
      invalid
    );
    const entries = Object.entries(value).map(
      ([key, child]) =>
        [text(key, normalize), visit(child, normalize, parents)] as const
    );
    requireSeal(
      new Set(entries.map(([key]) => key)).size === entries.length,
      invalid
    );

    return Object.fromEntries(entries);
  } finally {
    parents.delete(value);
  }
}

/** Normalization may change strings and object keys. Decode domain values afterwards. */
export function prepareNfc(value: unknown): Json {
  return visit(value, true);
}

function serialize(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    // Construct strings directly: JSON.stringify reorders integer-like object keys.
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function canonical(value: unknown): string {
  return serialize(visit(value, false));
}

export function parseCanonical(bytes: string | Uint8Array): Json {
  try {
    const source =
      typeof bytes === 'string'
        ? bytes
        : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            bytes
          );
    const value = visit(JSON.parse(source), false);
    requireSeal(
      serialize(value) === source && serialize(prepareNfc(value)) === source,
      invalid
    );

    return value;
  } catch {
    throw new SealError(invalid);
  }
}

export function isoDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  requireSeal(date instanceof Date && Number.isFinite(date.getTime()));
  const iso = date.toISOString();
  requireSeal(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso));
  requireSeal(typeof value !== 'string' || value === iso);

  return iso;
}
