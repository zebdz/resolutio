import { locales } from '@/src/i18n/locales';
import { isValidReturnToPath } from './returnToValidation';

// Never worth returning to: the auth chain itself (returning there would loop)
// and the error pages. Compared after the locale prefix is stripped.
export const RETURN_TO_SKIP_PATHS = [
  '/',
  '/login',
  '/register',
  '/confirm-phone',
  '/privacy-setup',
  '/blocked',
  '/rate-limited',
  '/ip-blocked',
];

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/');

  if (segments.length > 1 && locales.includes(segments[1] as never)) {
    const rest = `/${segments.slice(2).join('/')}`;

    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }

  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

/**
 * Decides whether a request is worth remembering as a post-login destination,
 * and in what form. Returns the locale-less path to store, or null to skip.
 *
 * The stored path must not carry the locale: LoginForm and PrivacySetupForm
 * navigate with the next-intl router, which prepends the active locale itself.
 *
 * Pure on purpose — the rules are the part worth testing, not the plumbing.
 */
export function resolveReturnToPath(input: {
  pathname: string;
  method: string;
  accept: string | null;
}): string | null {
  if (input.method !== 'GET') {
    return null;
  }

  if (!(input.accept ?? '').includes('text/html')) {
    return null;
  }

  if (input.pathname.startsWith('/api')) {
    return null;
  }

  const path = stripLocalePrefix(input.pathname);

  if (RETURN_TO_SKIP_PATHS.includes(path)) {
    return null;
  }

  if (!isValidReturnToPath(path)) {
    return null;
  }

  return path;
}
