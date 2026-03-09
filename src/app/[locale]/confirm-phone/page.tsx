import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/app/components/catalyst/auth-layout';
import { ConfirmPhoneForm } from '@/web/components/auth/ConfirmPhoneForm';
import { getCurrentUser } from '@/web/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('auth.confirmPhone');

  return { title: t('title') };
}

export default async function ConfirmPhonePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Already confirmed — go to privacy setup or home
  if (user.isConfirmed()) {
    if (!user.privacySetupCompleted) {
      redirect('/privacy-setup');
    }

    redirect('/home');
  }

  // Mask phone for display: +7916***4567
  const phone = user.phoneNumber.getValue();
  const maskedPhone = phone.replace(
    /^(\+\d{1,4})(\d*)(\d{4})$/,
    (_, prefix, middle, last) => `${prefix}${'*'.repeat(middle.length)}${last}`
  );

  return (
    <AuthLayout>
      <ConfirmPhoneForm maskedPhone={maskedPhone} />
    </AuthLayout>
  );
}
