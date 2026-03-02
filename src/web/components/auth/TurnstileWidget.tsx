'use client';

import { Turnstile } from '@marsidev/react-turnstile';

type Props = {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
};

export function TurnstileWidget({ onSuccess, onError, onExpire }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return null;
  }

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{
        theme: 'auto',
        size: 'flexible',
      }}
    />
  );
}
