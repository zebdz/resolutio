/** Printable evidence metadata for sealed and live protocol documents, in both supported locales. */
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import ru from '../../../../messages/ru.json';
import { BitcoinHeight, Digest, UtcTimestamp } from '@/domain/seal/SealValues';
import { sealFooter } from './sealFooter';

const rootDigest = Digest.parse('a'.repeat(64));
const time = UtcTimestamp.parse('2026-11-20T15:25:27.000Z');

describe('printed poll record verification', () => {
  it.each([
    { locale: 'en', messages: en },
    { locale: 'ru', messages: ru },
  ] as const)(
    'prints the frozen digest, confirmed block, date, URL and QR in $locale',
    ({ locale, messages }) => {
      const footer = sealFooter(
        {
          kind: 'sealed',
          seal: {
            rootDigest,
            status: {
              kind: 'bitcoin',
              height: BitcoinHeight.parse(976744),
              time,
            },
          },
        },
        'poll1',
        locale,
        messages
      );
      const serialized = JSON.stringify(footer);
      expect(serialized).toContain(rootDigest);
      expect(serialized).toContain('976744');
      expect(serialized).toContain('2026');
      expect(serialized).toContain(messages.seal.pdf.coverage);
      expect(serialized).toContain('/' + locale + '/verify/poll1');
      expect(serialized).toMatch(/"qr":"https?:/);
    }
  );
  it.each(['preliminary', 'sealing', 'unsealed'] as const)(
    'labels %s exports without a digest, verification URL or QR',
    (coverage) => {
      const block = sealFooter({ kind: 'live', coverage }, 'poll1', 'en', en);
      const expected =
        coverage === 'preliminary'
          ? en.seal.pdf.preliminary
          : en.sealStatus[coverage];
      expect(block).toMatchObject({ text: expected });
      expect(JSON.stringify(block)).not.toMatch(/https?:|qr|[a-f0-9]{64}/);
    }
  );
  it.each([
    { kind: 'awaitingSubmission' },
    { kind: 'pending' },
    { kind: 'simulated' },
    { kind: 'failed', provider: 'opentimestamps' },
  ] as const)(
    'identifies $kind evidence without printing a confirmed block',
    (status) => {
      const block = sealFooter(
        { kind: 'sealed', seal: { rootDigest, status } },
        'poll1',
        'ru',
        ru
      );
      expect(JSON.stringify(block)).toContain(ru.sealStatus[status.kind]);
      expect(JSON.stringify(block)).not.toMatch(/976744/);
    }
  );
});
