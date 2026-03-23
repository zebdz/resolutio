export type SuperadminAuthResult =
  | { userId: string }
  | { success: false; error: string };

export function isError(
  result: SuperadminAuthResult
): result is { success: false; error: string } {
  return 'success' in result && result.success === false;
}
