/** Capture mail in process to check private attachments, localized copy and receipt replay. */
import { it, expect, vi } from 'vitest';
import { canonical } from '@/domain/seal/Canonical';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { success } from '@/domain/shared/Result';
import { BundleDelivery, DeliveryKey } from '../BundleDelivery';
import { EvidenceMail } from '../EvidenceMail';
import { NextIntlEmailTemplateRenderer } from '@/infrastructure/email/NextIntlEmailTemplateRenderer';

it.each(['ru', 'en'] as const)(
  'sends the exact original, localized and HTML-escaped for %s',
  async (language) => {
    const to = EmailAddress.create('voter@example.org');
    const send = vi.fn().mockResolvedValue({ success: true });
    const receipt = JSON.parse(fixture.receipt);
    receipt.pollTitle = '<Budget & Finance>';
    const original = canonical(receipt);
    const mail = new EvidenceMail(
      { confirmed: async () => success({ address: to, language }) },
      new NextIntlEmailTemplateRenderer(),
      { send },
      'https://app.example.org'
    );
    expect(
      await mail.receipt({
        kind: 'original',
        receipt,
        canonicalReceipt: original,
      })
    ).toBe('sent');
    const message = send.mock.calls[0][0];
    expect(message.attachments).toEqual([
      {
        filename: 'receipt.json',
        content: original,
        contentType: 'application/json',
      },
    ]);
    expect(message.text).toContain(receipt.receiptSecret);
    expect(message.text).toContain(receipt.leaves[0].answerText);
    expect(message.text).toContain(receipt.leaves[0].hash);
    expect(message.text).toContain(
      'https://app.example.org/' + language + '/verify/' + receipt.pollId
    );
    expect(message.subject).toContain(
      language === 'ru' ? 'Квитанция' : 'Vote receipt'
    );
    expect(message.html).toContain(receipt.receiptSecret);
    expect(message.html).toContain('&lt;Budget &amp; Finance&gt;');
  }
);

it('skips the cast-time attachment when the voter has no confirmed email', async () => {
  const send = vi.fn();
  const mail = new EvidenceMail(
    { confirmed: async () => success(null) },
    new NextIntlEmailTemplateRenderer(),
    { send },
    'https://app.example.org'
  );
  expect(
    await mail.receipt({
      kind: 'original',
      receipt: JSON.parse(fixture.receipt),
      canonicalReceipt: fixture.receipt,
    })
  ).toBe('unconfirmed');
  expect(send).not.toHaveBeenCalled();
});

it('keeps processing other recipients when one export reader fails before claiming', async () => {
  const keys = ['first', 'second'].map((userId) =>
    DeliveryKey.parse({ pollId: 'poll1', userId })
  );
  const claim = vi.fn();
  const checked: string[] = [];
  const mail = new EvidenceMail(
    {
      confirmed: async (id) => {
        checked.push(id);

        if (id === keys[0].userId) {
          throw Error('connection interrupted');
        }

        return success(null);
      },
    },
    new NextIntlEmailTemplateRenderer(),
    { send: vi.fn() },
    'https://app.example.org'
  );
  const delivery = new BundleDelivery(
    { discover: async () => success(keys), claim, complete: vi.fn() },
    mail,
    { myProof: vi.fn(), proof: vi.fn() }
  );
  expect(await delivery.recover(2)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  expect(checked).toEqual(['first', 'second']);
  expect(claim).not.toHaveBeenCalled();
});
