import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

export function consumeReturnToClient(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${RETURN_TO_COOKIE_NAME}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;

  if (value) {
    document.cookie = `${RETURN_TO_COOKIE_NAME}=; max-age=0; path=/`;

    if (!isValidReturnToPath(value)) {
      return null;
    }
  }

  return value;
}
