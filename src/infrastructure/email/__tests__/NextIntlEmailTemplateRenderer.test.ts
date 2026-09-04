import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import { OtpPurposes } from '@/domain/otp/OtpVerification';

/**
 * NextIntlEmailTemplateRenderer resolves namespaces from a hand-written map of
 * dotted strings. A typo there fails only at send time, on the one code path
 * that has no user watching it — so pin the keys to the message files here.
 */
const EXPECTED_OTP_NAMESPACES: Record<string, string> = {
  [OtpPurposes.PHONE_CONFIRMATION]: 'email.otp.phoneConfirmation',
  [OtpPurposes.EMAIL_CONFIRMATION]: 'email.otp.emailConfirmation',
  [OtpPurposes.PASSWORD_RESET]: 'email.otp.passwordReset',
};

function resolve(messages: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      messages
    );
}

describe('email templates', () => {
  it.each(Object.entries(EXPECTED_OTP_NAMESPACES))(
    'has a subject and body for %s in both locales',
    (_purpose, namespace) => {
      for (const [locale, messages] of [
        ['en', en],
        ['ru', ru],
      ] as const) {
        const block = resolve(
          messages as unknown as Record<string, unknown>,
          namespace
        ) as { subject?: string; body?: string } | undefined;

        expect(block, `${locale} is missing ${namespace}`).toBeDefined();
        expect(typeof block?.subject).toBe('string');
        expect(typeof block?.body).toBe('string');
      }
    }
  );

  it('parameterizes the code and expiry rather than hardcoding them', () => {
    for (const namespace of Object.values(EXPECTED_OTP_NAMESPACES)) {
      for (const messages of [en, ru]) {
        const block = resolve(
          messages as unknown as Record<string, unknown>,
          namespace
        ) as { body: string };

        expect(block.body).toContain('{code}');
        expect(block.body).toContain('{minutes}');
      }
    }
  });

  it('has the address-change notice in both locales, parameterized', () => {
    for (const messages of [en, ru]) {
      const block = resolve(
        messages as unknown as Record<string, unknown>,
        'email.notifications.emailChanged'
      ) as { subject: string; body: string } | undefined;

      expect(block).toBeDefined();
      expect(typeof block?.subject).toBe('string');
      expect(block?.body).toContain('{newEmail}');
    }
  });
});
