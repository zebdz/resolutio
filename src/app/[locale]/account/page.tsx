import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Divider } from '@/app/components/catalyst/divider';
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from '@/app/components/catalyst/description-list';
import { AccountForm } from '@/web/components/account/AccountForm';
import { logoutAction } from '@/web/actions/auth';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

export async function generateMetadata() {
  const t = await getTranslations('account');

  return {
    title: t('title'),
  };
}

export default async function AccountPage() {
  const t = await getTranslations('account');
  const user = await getCurrentUser();

  // AuthenticatedLayout handles redirect if no user
  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
          <Text>{t('subtitle')}</Text>
        </div>

        <Divider />

        {/* Personal Information (Read-only) */}
        <div className="space-y-4">
          <Heading level={2} className="text-xl font-semibold">
            {t('personalInfo')}
          </Heading>
          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <DescriptionList>
              <DescriptionTerm>{t('firstName')}</DescriptionTerm>
              <DescriptionDetails>{user.firstName}</DescriptionDetails>

              <DescriptionTerm>{t('middleName')}</DescriptionTerm>
              <DescriptionDetails>{user.middleName || '—'}</DescriptionDetails>

              <DescriptionTerm>{t('lastName')}</DescriptionTerm>
              <DescriptionDetails>{user.lastName}</DescriptionDetails>

              <DescriptionTerm>{t('phoneNumber')}</DescriptionTerm>
              <DescriptionDetails>
                {user.phoneNumber.toString()}
              </DescriptionDetails>

              <DescriptionTerm>{t('memberSince')}</DescriptionTerm>
              <DescriptionDetails>
                {new Date(user.createdAt).toLocaleDateString(user.language, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </DescriptionDetails>
            </DescriptionList>
          </div>
        </div>

        {/* Editable Preferences */}
        <div className="space-y-4">
          <Heading level={2} className="text-xl font-semibold">
            {t('preferences')}
          </Heading>
          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <AccountForm
              user={{
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                middleName: user.middleName,
                phoneNumber: user.phoneNumber.toString(),
                language: user.language,
                createdAt: user.createdAt,
              }}
            />
          </div>
        </div>

        <Divider />

        {/* Logout */}
        <div className="flex justify-center">
          <form action={logoutAction}>
            <Button type="submit" color="red">
              {t('logout')}
            </Button>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
