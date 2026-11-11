/** Environment composition must reject malformed OTP lifetimes before delivery.
 * Fake rendering and transport keep this configuration check independent of mail I/O. */
import { afterEach, expect, it, vi } from 'vitest';
import { createEmailDeliveryChannelFromEnv } from '../emailDeliveryChannelFactory';
import { ClientIp } from '@/domain/auth/AuthValues';
import {
  OtpDigits,
  OtpEmailDestination,
  OtpPurposes,
} from '@/domain/otp/OtpValues';

const render = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ subject: 'Code', text: 'OTP' })
);

vi.mock('@/infrastructure/email/emailSenderFactory', () => ({
  createEmailSenderFromEnv: () => ({
    send: vi.fn().mockResolvedValue({ success: true }),
  }),
}));
vi.mock('@/infrastructure/email/NextIntlEmailTemplateRenderer', () => ({
  NextIntlEmailTemplateRenderer: class {
    renderOtp = render;
  },
}));

afterEach(() => vi.unstubAllEnvs());

it.each(['2.5', '2junk'])('rejects malformed OTP lifetime %s', (value) => {
  vi.stubEnv('OTP_EXPIRY_MINUTES', value);
  expect(() => createEmailDeliveryChannelFromEnv()).toThrow();
});

it.each([
  [undefined, 10],
  ['', 10],
  ['25', 25],
  [' 25 ', 25],
] as const)(
  'renders the configured/default lifetime %j',
  async (value, expected) => {
    vi.stubEnv('OTP_EXPIRY_MINUTES', value);
    const channel = createEmailDeliveryChannelFromEnv();
    const recipient = OtpEmailDestination.parse({
      channel: 'email',
      identifier: 'voter@example.com',
    });
    expect(
      await channel.send(
        recipient.identifier,
        OtpDigits.parse('123456'),
        'en',
        ClientIp.parse('127.0.0.1'),
        OtpPurposes.EMAIL_CONFIRMATION
      )
    ).toEqual({ success: true });
    expect(render).toHaveBeenLastCalledWith(
      OtpPurposes.EMAIL_CONFIRMATION,
      'en',
      '123456',
      expected
    );
  }
);
