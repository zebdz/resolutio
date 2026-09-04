/**
 * End-to-end verification of the password-reset flow against the real
 * database and the real use cases — no mocks. Every unit test in this feature
 * mocks its repositories, so this is what actually proves the `purpose` column
 * and `findByEmail` round-trip through Prisma.
 *
 * Creates a scratch user, exercises the flow, then deletes everything it made.
 * Run with: npx tsx prisma/verify-password-reset.ts
 */
// Must precede the prisma import — the client reads DATABASE_URL at module
// load. Same convention as prisma/seed.ts.
import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma';
import { PrismaUserRepository } from '../src/infrastructure/repositories/PrismaUserRepository';
import { PrismaOtpRepository } from '../src/infrastructure/repositories/PrismaOtpRepository';
import { PrismaSessionRepository } from '../src/infrastructure/repositories/PrismaSessionRepository';
import { OtpCodeHasherImpl } from '../src/infrastructure/auth/OtpCodeHasherImpl';
import { Argon2PasswordHasher } from '../src/infrastructure/auth/Argon2PasswordHasher';
import { Argon2PasswordVerifier } from '../src/infrastructure/auth/Argon2PasswordVerifier';
import { EmailOtpDeliveryChannel } from '../src/infrastructure/auth/EmailOtpDeliveryChannel';
import { StubEmailSender } from '../src/infrastructure/email/StubEmailSender';
import { RequestPasswordResetUseCase } from '../src/application/auth/RequestPasswordResetUseCase';
import { ResetPasswordWithOtpUseCase } from '../src/application/auth/ResetPasswordWithOtpUseCase';
import { User } from '../src/domain/user/User';
import { PhoneNumber } from '../src/domain/user/PhoneNumber';
import { Nickname } from '../src/domain/user/Nickname';
import { EmailAddress } from '../src/domain/user/EmailAddress';
import {
  OtpPurposes,
  OtpVerification,
} from '../src/domain/otp/OtpVerification';
import type { RenderedEmail } from '../src/application/auth/EmailTemplateRenderer';
import type { OtpPurpose } from '../src/domain/otp/OtpVerification';

const STAMP = Date.now();
const PHONE = '+799900' + String(STAMP).slice(-5);
const EMAIL = `reset-verify-${STAMP}@example.test`;
const OLD_PASSWORD = 'OldPassword-2026';
const NEW_PASSWORD = 'Korova-Zabor-71';

// Captures the plaintext code the way the dev log would.
let lastCode: string | null = null;

const templateRenderer = {
  async renderOtp(
    purpose: OtpPurpose,
    _locale: string,
    code: string
  ): Promise<RenderedEmail> {
    lastCode = code;

    return { subject: `[${purpose}]`, text: `code=${code}` };
  },
  async renderEmailChangedNotice(): Promise<RenderedEmail> {
    return { subject: 'changed', text: 'changed' };
  },
};

const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl('verify-secret');
const passwordHasher = new Argon2PasswordHasher();
const passwordVerifier = new Argon2PasswordVerifier();

const deliveryChannel = new EmailOtpDeliveryChannel({
  emailSender: new StubEmailSender(),
  templateRenderer,
  expiryMinutes: 10,
});

const requestReset = new RequestPasswordResetUseCase({
  userRepository,
  otpRepository,
  deliveryChannel,
  otpCodeHasher,
  expiryMinutes: 10,
});

const resetPassword = new ResetPasswordWithOtpUseCase({
  userRepository,
  otpRepository,
  sessionRepository,
  otpCodeHasher,
  passwordHasher,
});

const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
}

async function main() {
  let userId: string | null = null;

  try {
    // --- Arrange: a real user with a confirmed email ---
    const created = await userRepository.save(
      User.create({
        firstName: 'Verify',
        lastName: 'Scratch',
        phoneNumber: PhoneNumber.create(PHONE),
        password: await passwordHasher.hash(OLD_PASSWORD),
        nickname: Nickname.create(`verify_${String(STAMP).slice(-6)}`),
        email: EmailAddress.create(EMAIL),
      })
    );
    userId = created.id;

    await userRepository.save(created.confirmEmail());

    const reloaded = await userRepository.findById(userId);
    check(
      'email + confirmation round-trip through Prisma',
      reloaded?.email?.getValue() === EMAIL && reloaded.hasConfirmedEmail(),
      `email=${reloaded?.email?.getValue()} confirmed=${reloaded?.hasConfirmedEmail()}`
    );

    check(
      'findByEmail resolves the user (case-insensitively)',
      (
        await userRepository.findByEmail(
          EmailAddress.create(EMAIL.toUpperCase())
        )
      )?.id === userId
    );

    // A live session, to prove the reset revokes it.
    const session = await sessionRepository.create(
      userId,
      new Date(Date.now() + 3600_000)
    );

    // --- Request by PHONE, reset by EMAIL: both resolve to one address ---
    lastCode = null;
    const requested = await requestReset.execute({
      identifier: PHONE,
      clientIp: '127.0.0.1',
    });
    check('request by phone reports success', requested.success);
    check(
      'a code was actually delivered',
      lastCode !== null,
      `code=${lastCode}`
    );

    const storedOtp = await otpRepository.findLatestByIdentifier(
      EMAIL,
      'email',
      OtpPurposes.PASSWORD_RESET
    );
    check(
      'purpose column round-trips through Prisma',
      storedOtp?.purpose === OtpPurposes.PASSWORD_RESET,
      `purpose=${storedOtp?.purpose}`
    );
    check(
      'only the hash is stored, never the plaintext',
      !!storedOtp && storedOtp.code !== lastCode
    );

    // --- Cross-purpose replay must be blocked ---
    const confirmationOtp = await otpRepository.save(
      OtpVerification.create({
        identifier: EMAIL,
        channel: 'email',
        purpose: OtpPurposes.EMAIL_CONFIRMATION,
        code: otpCodeHasher.hash('999999'),
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 600_000),
        userId,
      })
    );
    const replay = await resetPassword.execute({
      identifier: EMAIL,
      code: '999999',
      newPassword: NEW_PASSWORD,
    });
    check(
      'an email_confirmation code cannot reset a password',
      !replay.success,
      replay.success ? 'REPLAY SUCCEEDED' : `rejected: ${replay.error}`
    );

    // --- No enumeration ---
    const unknown = await requestReset.execute({
      identifier: `absent-${STAMP}@example.test`,
      clientIp: '127.0.0.1',
    });
    check('an unknown account still reports success', unknown.success);

    const rowsForUnknown = await prisma.otpVerification.count({
      where: { identifier: `absent-${STAMP}@example.test` },
    });
    check(
      'and writes no OTP row',
      rowsForUnknown === 0,
      `rows=${rowsForUnknown}`
    );

    // --- The real reset, by email this time ---
    const reset = await resetPassword.execute({
      identifier: EMAIL,
      code: lastCode!,
      newPassword: NEW_PASSWORD,
    });
    check(
      'the code resets the password',
      reset.success,
      reset.success ? undefined : reset.error
    );

    const after = await userRepository.findById(userId);
    check(
      'the new password verifies',
      await passwordVerifier.verify(NEW_PASSWORD, after!.password)
    );
    check(
      'the old password no longer works',
      !(await passwordVerifier.verify(OLD_PASSWORD, after!.password))
    );
    check(
      'every session was revoked',
      (await sessionRepository.findById(session.id)) === null
    );

    // --- Single use ---
    const reuse = await resetPassword.execute({
      identifier: EMAIL,
      code: lastCode!,
      newPassword: 'Another-Password-99',
    });
    check(
      'the same code cannot be spent twice',
      !reuse.success,
      reuse.success ? 'REUSE SUCCEEDED' : `rejected: ${reuse.error}`
    );

    void confirmationOtp;
  } finally {
    // Remove everything this script created. Scratch data only — the app's
    // "never delete, only archive" rule is about real domain records.
    if (userId) {
      await prisma.otpVerification.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      console.log('\nCleaned up scratch user', userId);
    }

    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
