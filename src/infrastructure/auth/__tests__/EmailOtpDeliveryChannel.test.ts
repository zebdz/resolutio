/** Mail contracts retain validated addresses and serialize only inside the delivery adapter. */
import { EmailAddress } from '@/domain/user/EmailAddress';
/** Provider requests serialize validated OTP inputs; malformed transport facts fail before delivery. */
import {
  OtpEmailDestination,
  OtpSmsDestination,
  OtpDigits,
} from '@/domain/otp/OtpValues';
import { ClientIp } from '@/domain/auth/AuthValues';
import { Minutes } from '@/domain/auth/AuthValues';

import { describe, it, expect, vi } from 'vitest';
import { EmailOtpDeliveryChannel } from '../EmailOtpDeliveryChannel';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import type { EmailSender } from '@/application/auth/EmailSender';
import type { EmailTemplateRenderer } from '@/application/auth/EmailTemplateRenderer';

function build(
  overrides: {
    sendResult?: { success: boolean; backdoorPreview?: string };
  } = {}
) {
  const emailSender: EmailSender = {
    send: vi.fn().mockResolvedValue(overrides.sendResult ?? { success: true }),
  };

  const templateRenderer: EmailTemplateRenderer = {
    renderOtp: vi.fn().mockResolvedValue({
      subject: 'Сброс пароля',
      text: 'Ваш код: 123456. Он действует 10 минут.',
    }),
    renderEmailChangedNotice: vi.fn(),
  };

  return {
    emailSender,
    templateRenderer,
    channel: new EmailOtpDeliveryChannel({
      emailSender,
      templateRenderer,
      expiryMinutes: Minutes.parse(10),
    }),
  };
}

describe('EmailOtpDeliveryChannel', () => {
  it('rejects a phone recipient before rendering or sending email', async () => {
    const { channel, emailSender, templateRenderer } = build();
    const phone = OtpSmsDestination.parse({
      channel: 'sms',
      identifier: '+79161234567',
    });
    const result = await channel.send(
      // @ts-expect-error Exercise an untyped caller bypassing the email-recipient contract.
      phone.identifier,
      OtpDigits.parse('123456'),
      'ru',
      ClientIp.parse('127.0.0.1'),
      OtpPurposes.EMAIL_CONFIRMATION
    );
    expect(result).toEqual({ success: false });
    expect(templateRenderer.renderOtp).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('declares the email channel', () => {
    expect(build().channel.channel).toBe('email');
  });

  it('renders the template for the requested purpose and locale', async () => {
    const { channel, templateRenderer } = build();

    await channel.send(
      OtpEmailDestination.parse({
        channel: 'email',
        identifier: 'ivan@mail.ru',
      }).identifier,
      OtpDigits.parse('123456'),
      'ru',
      ClientIp.parse('127.0.0.1'),
      OtpPurposes.PASSWORD_RESET
    );

    expect(templateRenderer.renderOtp).toHaveBeenCalledWith(
      OtpPurposes.PASSWORD_RESET,
      'ru',
      '123456',
      10
    );
  });

  it('sends the rendered message to the recipient', async () => {
    const { channel, emailSender } = build();

    await channel.send(
      OtpEmailDestination.parse({
        channel: 'email',
        identifier: 'ivan@mail.ru',
      }).identifier,
      OtpDigits.parse('123456'),
      'ru',
      ClientIp.parse('127.0.0.1'),
      OtpPurposes.EMAIL_CONFIRMATION
    );

    expect(emailSender.send).toHaveBeenCalledWith({
      to: EmailAddress.create('ivan@mail.ru'),
      subject: 'Сброс пароля',
      text: 'Ваш код: 123456. Он действует 10 минут.',
    });
  });

  it('propagates a delivery failure', async () => {
    const { channel } = build({ sendResult: { success: false } });

    const result = await channel.send(
      OtpEmailDestination.parse({
        channel: 'email',
        identifier: 'ivan@mail.ru',
      }).identifier,
      OtpDigits.parse('123456'),
      'ru',
      ClientIp.parse('127.0.0.1'),
      OtpPurposes.PASSWORD_RESET
    );

    expect(result.success).toBe(false);
  });

  // The stub surfaces the body so a developer can read the code; the channel
  // has to pass that through or the dev flow is unusable without SMTP.
  it('passes the stub preview through as the backdoor code', async () => {
    const { channel } = build({
      sendResult: { success: true, backdoorPreview: 'Ваш код: 123456' },
    });

    const result = await channel.send(
      OtpEmailDestination.parse({
        channel: 'email',
        identifier: 'ivan@mail.ru',
      }).identifier,
      OtpDigits.parse('123456'),
      'ru',
      ClientIp.parse('127.0.0.1'),
      OtpPurposes.PASSWORD_RESET
    );

    expect(result.backdoorCode).toBe('Ваш код: 123456');
  });
});
