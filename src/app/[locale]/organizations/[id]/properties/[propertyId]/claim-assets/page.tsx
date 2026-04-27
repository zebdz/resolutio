import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getCurrentUser } from '@/web/lib/session';
import {
  listClaimableAssetsAction,
  listMyClaimsForPropertyAction,
} from '@/src/web/actions/organization/propertyClaim';
import { Heading } from '@/src/web/components/catalyst/heading';
import { ClaimAssetsClient } from './ClaimAssetsClient';
import { MyClaimsList } from './MyClaimsList';

export default async function ClaimAssetsPage({
  params,
}: {
  params: Promise<{ id: string; propertyId: string; locale: string }>;
}) {
  const { id, propertyId, locale } = await params;
  const t = await getTranslations('propertyClaim.page');
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const [assetsRes, myClaimsRes] = await Promise.all([
    listClaimableAssetsAction({ organizationId: id, propertyId }),
    listMyClaimsForPropertyAction({ organizationId: id, propertyId }),
  ]);

  if (!assetsRes.success) {
    redirect(`/${locale}/organizations/${id}`);
  }

  const myClaims = myClaimsRes.success ? myClaimsRes.data.rows : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Link
          href={`/organizations/${id}`}
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← {t('back')}
        </Link>
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <ClaimAssetsClient organizationId={id} assets={assetsRes.data.assets} />
        <MyClaimsList claims={myClaims} />
      </div>
    </AuthenticatedLayout>
  );
}
