import { getLocale, getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/src/web/components/catalyst/auth-layout';
import { ConfirmPhoneForm } from '@/web/components/auth/ConfirmPhoneForm';
import { GetPhoneConfirmationStatusUseCase } from '@/application/auth/GetPhoneConfirmationStatusUseCase';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  createSmsDeliveryChannelFromEnv,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { readReturnToCookieServer } from '@/web/lib/returnTo.server';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

const statusUseCase = new GetPhoneConfirmationStatusUseCase({
  otpRepository: new PrismaOtpRepository(prisma),
  userRepository: new PrismaUserRepository(prisma),
  deliveryChannel: createSmsDeliveryChannelFromEnv(),
});

export async function generateMetadata() {
  const t = await getTranslations('auth.confirmPhone');

  return { title: t('title') };
}

export default async function ConfirmPhonePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirectLocalized(await getLocale(), '/login');
  }

  // Already confirmed — go to privacy setup, or wherever the visitor was headed
  if (user.isConfirmed()) {
    if (!user.privacySetupCompleted) {
      redirectLocalized(await getLocale(), '/privacy-setup');
    }

    const returnTo = await readReturnToCookieServer();
    redirectLocalized(await getLocale(), returnTo || '/home');
  }

  // Mask phone for display: +7916***4567
  const phone = user.phoneNumber.getValue();
  const maskedPhone = phone.replace(
    /^(\+\d{1,4})(\d*)(\d{4})$/,
    (_, prefix, middle, last) => `${prefix}${'*'.repeat(middle.length)}${last}`
  );

  // The form renders from server-known state: whether a code is waiting to be
  // entered and when another may be requested. Nothing is carried over from
  // the register/login step in browser storage any more, so a reload or a
  // redirect here lands on the same screen as the first visit.
  const status = await statusUseCase.execute({ userId: user.id });

  // The user was loaded a moment ago, so the only failure is a vanished row;
  // fall back to "request a code" rather than crash.
  const { hasPendingCode, retryAfterSeconds } = status.success
    ? status.value
    : { hasPendingCode: false, retryAfterSeconds: 0 };

  return (
    <AuthLayout>
      <ConfirmPhoneForm
        maskedPhone={maskedPhone}
        hasPendingCode={hasPendingCode}
        retryAfterSeconds={retryAfterSeconds}
      />
    </AuthLayout>
  );
}
