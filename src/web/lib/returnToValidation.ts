export const RETURN_TO_COOKIE_NAME = 'returnTo';

export function isValidReturnToPath(path: string): boolean {
  if (!path.startsWith('/')) {
    return false;
  }

  if (path.startsWith('//')) {
    return false;
  }

  const afterSlash = path.substring(1);
  const slashIndex = afterSlash.indexOf('/');
  const colonIndex = afterSlash.indexOf(':');

  if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
    return false;
  }

  return true;
}
