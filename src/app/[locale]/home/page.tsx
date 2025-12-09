import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from '@/app/components/catalyst/description-list';
import { logoutAction } from '@/web/actions/auth';

export default async function HomePage() {
  const t = await getTranslations('home');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <Heading className="text-4xl font-bold">{t('title')}</Heading>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <DescriptionList>
            <DescriptionTerm>First Name</DescriptionTerm>
            <DescriptionDetails>{user.firstName}</DescriptionDetails>

            <DescriptionTerm>Last Name</DescriptionTerm>
            <DescriptionDetails>{user.lastName}</DescriptionDetails>

            {user.middleName && (
              <>
                <DescriptionTerm>Middle Name</DescriptionTerm>
                <DescriptionDetails>{user.middleName}</DescriptionDetails>
              </>
            )}

            <DescriptionTerm>Phone Number</DescriptionTerm>
            <DescriptionDetails>
              {user.phoneNumber.toString()}
            </DescriptionDetails>

            <DescriptionTerm>Member Since</DescriptionTerm>
            <DescriptionDetails>
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </DescriptionDetails>
          </DescriptionList>

          <div className="mt-8 flex justify-center">
            <form action={logoutAction}>
              <Button type="submit" color="red">
                {t('logout', { defaultValue: 'Logout' })}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
