import { cookies } from 'next/headers';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

/**
 * Read-only on purpose: a Server Component may not write cookies in Next 15,
 * and deleting here throws "Cookies can only be modified in a Server Action or
 * Route Handler". The middleware overwrites the cookie on the next navigation
 * and it expires on its own, so treat it as a hint about where the visitor was
 * heading, not as a one-shot token.
 *
 * Client-side consumption (returnTo.client.ts) still clears the cookie — the
 * browser may write document.cookie freely.
 */
export async function readReturnToCookieServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RETURN_TO_COOKIE_NAME)?.value ?? null;

  if (!value || !isValidReturnToPath(value)) {
    return null;
  }

  return value;
}
