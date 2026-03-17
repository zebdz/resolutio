import { getTranslations } from 'next-intl/server';

/**
 * Translates an error code into a localized message.
 *
 * Error codes follow dotted paths that map directly to message keys:
 *   "organization.errors.notFound"          → messages.organization.errors.notFound
 *   "domain.organization.organizationNameEmpty" → messages.domain.organization.organizationNameEmpty
 *
 * The first segment is used as the namespace for getTranslations(),
 * and the rest becomes the key within that namespace.
 */
export async function translateErrorCode(errorCode: string): Promise<string> {
  const dotIndex = errorCode.indexOf('.');

  if (dotIndex === -1) {
    return errorCode;
  }

  const namespace = errorCode.substring(0, dotIndex);
  const key = errorCode.substring(dotIndex + 1);

  try {
    const t = await getTranslations(namespace);

    return t(key as any);
  } catch {
    return errorCode;
  }
}
