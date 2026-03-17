import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaJoinTokenRepository,
} from '@/infrastructure/index';
import { GetJoinTokenPublicInfoUseCase } from '@/application/organization/GetJoinTokenPublicInfoUseCase';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { JoinConfirmButton } from './JoinConfirmButton';
import { SetReturnTo } from './SetReturnTo';

export default async function JoinTokenPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = await params;

  const organizationRepository = new PrismaOrganizationRepository(prisma);
  const joinTokenRepository = new PrismaJoinTokenRepository(prisma);
  const getPublicInfoUseCase = new GetJoinTokenPublicInfoUseCase({
    joinTokenRepository,
    organizationRepository,
    prisma,
  });

  const result = await getPublicInfoUseCase.execute(token);

  if (!result.success) {
    const errorMessage = await translateErrorCode(result.error);

    const tCommonErr = await getTranslations('common');

    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="space-y-4">
          <Link
            href="/home"
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommonErr('backToHome')}
          </Link>
          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <Text className="text-center text-red-600 dark:text-red-400">
              {errorMessage}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  const data = result.value;
  const t = await getTranslations('joinToken.page');
  const user = await getCurrentUser();

  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="space-y-6">
        {user && (
          <Link
            href="/home"
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommon('backToHome')}
          </Link>
        )}
        <div className="space-y-2 text-center">
          <Heading>{t('title', { orgName: data.organizationName })}</Heading>
          <Text>{t('description')}</Text>
        </div>

        <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="space-y-4">
            {data.organizationDescription && (
              <Text className="text-zinc-700 dark:text-zinc-300">
                {data.organizationDescription}
              </Text>
            )}
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('memberCount', { count: data.memberCount })}
            </Text>

            {user ? (
              <JoinConfirmButton token={token} />
            ) : (
              <div className="flex flex-col gap-3">
                <SetReturnTo path={'/join/' + token} />
                <Link href="/login" prefetch={false}>
                  <Button color="brand-green" className="w-full">
                    {t('loginToJoin')}
                  </Button>
                </Link>
                <Link href="/register" prefetch={false}>
                  <Button color="zinc" className="w-full">
                    {t('registerToJoin')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
