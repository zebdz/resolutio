/** Explicit expected outcomes shared by the core and its ports.
 * Batch collection preserves failures instead of silently discarding invalid members. */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const success = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

export const failure = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

export function collectResults<T, E>(
  results: readonly Result<T, E>[]
): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.success) {
      return result;
    }

    values.push(result.value);
  }

  return success(values);
}
