import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmailSenderFromEnv } from '../emailSenderFactory';
import { StubEmailSender } from '../StubEmailSender';

describe('createEmailSenderFromEnv', () => {
  const originalHost = process.env.SMTP_HOST;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });

  afterEach(() => {
    if (originalHost === undefined) {
      delete process.env.SMTP_HOST;
    } else {
      process.env.SMTP_HOST = originalHost;
    }
  });

  // Dev and tests must never send real mail by accident, exactly as
  // createSmsDeliveryChannelFromEnv falls back when SMS_RU_API_ID is absent.
  it('falls back to the stub when SMTP_HOST is absent', () => {
    expect(createEmailSenderFromEnv()).toBeInstanceOf(StubEmailSender);
  });

  it('does not return the stub once SMTP_HOST is configured', () => {
    process.env.SMTP_HOST = 'smtp.yandex.ru';

    expect(createEmailSenderFromEnv()).not.toBeInstanceOf(StubEmailSender);
  });
});

describe('StubEmailSender', () => {
  it('reports success and echoes the body for dev inspection', async () => {
    const logged = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await new StubEmailSender().send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(true);
    expect(result.backdoorPreview).toBe('Ваш код: 123456');
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});
