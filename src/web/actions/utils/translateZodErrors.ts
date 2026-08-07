import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { ERROR_CODE_PARAMS } from './errorCodeParams';

/**
 * Translates Zod validation issues into localized field errors.
 * Messages starting with "domain." are treated as domain codes and translated;
 * all other messages are passed through as-is.
 *
 * Each code's ICU params (limits such as maxLength) come from the shared
 * ERROR_CODE_PARAMS table, looked up per code — a single flat object could not
 * serve a set of issues that mixes codes with different placeholders. Without
 * them next-intl declines to format the message and prints the bare code.
 *
 * @param params - extra ICU params forwarded to every domain-code translation,
 *                 overriding the table entry (e.g. { minLength: 5 })
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

    let msg = err.message;

    if (msg.startsWith('domain.')) {
      const codeParams = { ...ERROR_CODE_PARAMS[msg], ...params };

      msg = tDomain(msg.replace('domain.', '') as any, codeParams as any);
    }

    fieldErrors[path].push(msg);
  });

  return fieldErrors;
}
