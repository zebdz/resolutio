import { cookies } from 'next/headers';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

const MAX_AGE = 1800; // 30 minutes

export async function setReturnToCookie(path: string): Promise<void> {
  if (!isValidReturnToPath(path)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(RETURN_TO_COOKIE_NAME, path, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function consumeReturnToCookieServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RETURN_TO_COOKIE_NAME)?.value ?? null;

  if (value) {
    cookieStore.delete(RETURN_TO_COOKIE_NAME);

    if (!isValidReturnToPath(value)) {
      return null;
    }
  }

  return value;
}
