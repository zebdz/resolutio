/**
 * Canonicalizes line endings on text arriving from a FormData submission.
 *
 * The multipart/form-data encoding algorithm rewrites every lone LF as CRLF
 * in field values. A description the author typed with N line breaks
 * therefore reaches the server N characters longer than what they saw, so a
 * body sitting exactly on the length limit is rejected for a length that is
 * invisible from the editor.
 *
 * Normalizing here also keeps CRLF out of the database, which matters because
 * the stored text is markdown: the extra carriage returns would otherwise
 * travel into rendering, PDF export and every later edit.
 *
 * Apply at the interface boundary, before validation.
 */
export function normalizeFormText(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    return '';
  }

  // CRLF and lone CR both collapse to LF.
  return value.replace(/\r\n?/g, '\n');
}
