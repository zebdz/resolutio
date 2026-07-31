'use client';

import { useEffect } from 'react';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from '@/web/lib/returnToValidation';

export function SetReturnTo({ path }: { path: string }) {
  useEffect(() => {
    if (!isValidReturnToPath(path)) {
      return;
    }

    document.cookie = `${RETURN_TO_COOKIE_NAME}=${encodeURIComponent(path)}; max-age=1800; path=/; samesite=lax`;
  }, [path]);

  return null;
}
