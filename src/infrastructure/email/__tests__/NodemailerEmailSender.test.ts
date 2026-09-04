import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
  createTransport: vi.fn(() => ({ sendMail })),
}));

import { NodemailerEmailSender } from '../NodemailerEmailSender';

describe('NodemailerEmailSender', () => {
  const config = {
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    user: 'noreply@resolutio.ru',
    password: 'secret',
    from: 'Resolutio <noreply@resolutio.ru>',
  };

  beforeEach(() => {
    sendMail.mockReset();
  });

  it('sends the message through the transport', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код подтверждения',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Resolutio <noreply@resolutio.ru>',
        to: 'ivan@mail.ru',
        subject: 'Код подтверждения',
        text: 'Ваш код: 123456',
      })
    );
  });

  // A real transport must never echo the body back — backdoorPreview is a
  // stub-only affordance and leaking a live code into a log would defeat it.
  it('never returns a backdoor preview', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.backdoorPreview).toBeUndefined();
  });

  it('reports failure instead of throwing when the transport rejects', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(false);
    logged.mockRestore();
  });

  // The body carries a live OTP, so a failure must not log it.
  it('does not log the message body on failure', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    const logging = logged.mock.calls.flat().join(' ');
    expect(logging).not.toContain('123456');

    logged.mockRestore();
  });
});
