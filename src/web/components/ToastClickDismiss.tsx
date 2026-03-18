'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function ToastClickDismiss() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const toastEl = (e.target as HTMLElement).closest('[data-sonner-toast]');

      if (toastEl) {
        toast.dismiss();
      }
    };

    document.addEventListener('click', handleClick);

    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
