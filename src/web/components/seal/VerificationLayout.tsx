'use client';

/** Start with public navigation and personalize it over private HTTP. Session
 * reads stay out of Flight, and loading the header never remounts the verifier. */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { failure, success, type Result } from '@/domain/shared/Result';
import { MemberNavigation } from '@/web/lib/MemberNavigation';
import { SiteLayout } from '../layout/SiteLayout';

type Navigation = Result<MemberNavigation | null, 'navbar.unavailable'>;

async function readNavigation(signal: AbortSignal): Promise<Navigation> {
  try {
    const response = await fetch('/api/navigation', {
      cache: 'no-store',
      signal,
    });

    if (response.status === 204) {
      return success(null);
    }

    if (!response.ok) {
      return failure('navbar.unavailable');
    }

    const member = MemberNavigation.safeParse(await response.json());

    return member.success
      ? success(member.data)
      : failure('navbar.unavailable');
  } catch {
    return failure('navbar.unavailable');
  }
}

export function VerificationLayout({ children }: React.PropsWithChildren) {
  const t = useTranslations();
  const [navigation, setNavigation] = useState<Navigation>(success(null));

  useEffect(() => {
    const controller = new AbortController();
    void readNavigation(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setNavigation(result);
      }
    });

    return () => controller.abort();
  }, []);

  return (
    <SiteLayout member={navigation.success ? navigation.value : null}>
      <div className="mx-auto max-w-3xl space-y-6">
        {!navigation.success && <p role="status">{t(navigation.error)}</p>}
        {children}
      </div>
    </SiteLayout>
  );
}
