/** Multipart usage limits preserve exact numeric input until domain validation.
 * Missing/empty values mean unlimited; files and malformed values remain invalid. */
export function readJoinTokenLimit(value: FormDataEntryValue | null): unknown {
  if (value === null || value === '') {
    return null;
  }

  return typeof value === 'string' ? Number(value) : value;
}
