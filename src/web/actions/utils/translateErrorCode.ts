import { getTranslations } from 'next-intl/server';
import { ERROR_CODE_PARAMS } from './errorCodeParams';

/**
 * Translates an error code into a localized message.
 *
 * Error codes follow dotted paths that map directly to message keys:
 *   "organization.errors.notFound"          → messages.organization.errors.notFound
 *   "domain.organization.organizationNameEmpty" → messages.domain.organization.organizationNameEmpty
 *
 * The first segment is used as the namespace for getTranslations(),
 * and the rest becomes the key within that namespace.
 *
 * If the error code has associated params (e.g. maxLength for TooLong errors),
 * they are automatically looked up from ERROR_CODE_PARAMS and passed to the
 * ICU message formatter.
 */
export async function translateErrorCode(
  errorCode: string,
  paramsOrLocale?: Record<string, string | number> | { locale: string },
  maybeLocale?: { locale: string }
): Promise<string> {
  // Domain errors may embed dynamic params via a query-string suffix:
  //   domain.shared.containsProfanityWithWords?words=хуй%2C%20бля
  // Detect, strip, and merge into params.
  let bareCode = errorCode;
  let embeddedParams: Record<string, string> | undefined;
  const qIndex = errorCode.indexOf('?');

  if (qIndex !== -1) {
    bareCode = errorCode.substring(0, qIndex);
    embeddedParams = {};
    const query = errorCode.substring(qIndex + 1);

    for (const pair of query.split('&')) {
      if (!pair) {
        continue;
      }

      const [k, v = ''] = pair.split('=');
      embeddedParams[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }

  const dotIndex = bareCode.indexOf('.');

  if (dotIndex === -1) {
    return bareCode;
  }

  const namespace = bareCode.substring(0, dotIndex);
  const key = bareCode.substring(dotIndex + 1);

  // Caller may pass: (code), (code, params), (code, { locale }),
  // or (code, params, { locale }). Disambiguate.
  let params: Record<string, string | number> | undefined;
  let localeOpts: { locale: string } | undefined;

  if (
    paramsOrLocale &&
    typeof (paramsOrLocale as { locale?: unknown }).locale === 'string'
  ) {
    localeOpts = paramsOrLocale as { locale: string };
  } else {
    params = paramsOrLocale as Record<string, string | number> | undefined;
    localeOpts = maybeLocale;
  }

  const baseParams = params || ERROR_CODE_PARAMS[bareCode];
  const resolvedParams = embeddedParams
    ? { ...(baseParams ?? {}), ...embeddedParams }
    : baseParams;

  try {
    const t = localeOpts
      ? await getTranslations({ locale: localeOpts.locale, namespace })
      : await getTranslations(namespace);

    return resolvedParams ? t(key as any, resolvedParams) : t(key as any);
  } catch {
    return errorCode;
  }
}
