/** The private cast screen exposes the saved labels, individual hashes and recovery actions. */
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import { VoteReceipt } from '@/domain/seal/VoteReceipt';
import { VoteReceiptPanel } from '../VoteReceiptPanel';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/src/i18n/routing', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}));

const canonicalReceipt = readFileSync(
  'src/domain/seal/__tests__/fixtures/export-v1/receipt.json',
  'utf8'
);
const parsed = VoteReceipt.parse(canonicalReceipt);

if (!parsed.success) {
  throw new Error(parsed.error);
}

const receipt = parsed.value.data;

it('shows the cast-time labels, hashes, private code and JSON download', () => {
  const html = renderToStaticMarkup(
    <VoteReceiptPanel
      view={{
        kind: 'original',
        receipt,
        canonicalReceipt,
        emailStatus: 'sent',
      }}
    />
  );
  expect(html).toContain(receipt.pollTitle);
  expect(html).toContain(receipt.receiptSecret);

  for (const leaf of receipt.leaves) {
    expect(html).toContain(leaf.questionText);
    expect(html).toContain(leaf.answerText);
    expect(html).toContain(leaf.hash);
  }

  expect(html).toContain('download');
  expect(html).toContain('copyCode');
  expect(html).toContain('sent');
});

it('offers account confirmation only to voters without a confirmed address', () => {
  const html = renderToStaticMarkup(
    <VoteReceiptPanel
      view={{
        kind: 'original',
        receipt,
        canonicalReceipt,
        emailStatus: 'unconfirmed',
      }}
    />
  );
  expect(html).toContain('href="/account"');
  expect(html).toContain('confirmEmail');
  expect(html).toContain('download');
  expect(html).not.toContain('>sent<');
});
it('keeps the receipt available after mail failure', () => {
  const html = renderToStaticMarkup(
    <VoteReceiptPanel
      view={{
        kind: 'original',
        receipt,
        canonicalReceipt,
        emailStatus: 'failed',
      }}
    />
  );
  expect(html).toContain('>failed<');
  expect(html).toContain('download');
  expect(html).not.toContain('>sent<');
});
it('identifies a later download as a replay and makes no new delivery claim', () => {
  const html = renderToStaticMarkup(
    <VoteReceiptPanel view={{ kind: 'original', receipt, canonicalReceipt }} />
  );
  expect(html).toContain('>replay<');
  expect(html).not.toContain('>sent<');
});
it('identifies a legacy ballot without exposing a synthetic private code', () => {
  const html = renderToStaticMarkup(
    <VoteReceiptPanel view={{ kind: 'legacy' }} />
  );
  expect(html).toContain('>legacy<');
  expect(html).not.toContain('download');
  expect(html).not.toContain('copyCode');
});
