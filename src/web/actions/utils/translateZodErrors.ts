import { z } from 'zod';
import { getTranslations } from 'next-intl/server';

/**
 * Translates Zod validation issues into localized field errors.
 * Messages starting with "domain." are treated as domain codes and translated;
 * all other messages are passed through as-is.
 *
 * @param params - extra ICU params forwarded to every domain-code translation
 *                 (e.g. { minLength: 5, maxLength: 20 })
 */
export async function translateZodFieldErrors(
  issues: z.ZodIssue[],
  params?: Record<string, string | number>
): Promise<Record<string, string[]>> {
  const tDomain = await getTranslations('domain');
  const fieldErrors: Record<string, string[]> = {};

  issues.forEach((err) => {
    const path = err.path.join('.');

    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }

    const msg = err.message.startsWith('domain.')
      ? tDomain(err.message.replace('domain.', '') as any, params as any)
      : err.message;
    fieldErrors[path].push(msg);
  });

  return fieldErrors;
}
