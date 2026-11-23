/** Enforce account setup and moderation before rendering protected content in the site shell. */
import { getLocale } from 'next-intl/server';
import { redirectLocalized } from '@/web/lib/redirectLocalized';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { getSiteNavigation } from '@/web/lib/getSiteNavigation';
import { SiteLayout } from './SiteLayout';

export async function AuthenticatedLayout({
  children,
}: React.PropsWithChildren) {
  const navigation = await getSiteNavigation();

  if (!navigation.success) {
    return <div role="alert">{await translateErrorCode(navigation.error)}</div>;
  }

  if ('redirect' in navigation.value) {
    redirectLocalized(await getLocale(), navigation.value.redirect);
  }

  return <SiteLayout member={navigation.value}>{children}</SiteLayout>;
}
