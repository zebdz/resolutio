/** Renders the record commitment and its Bitcoin status on printed protocols.
 * The same footer supplies the generation date and page numbers to every protocol. */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ProtocolSource } from '@/application/seal/GetSealedProtocolUseCase';
import type { Locale } from '@/src/i18n/locales';
import { SITE_ORIGIN } from '@/infrastructure/shared/siteOrigin';
import type en from '../../../../messages/en.json';

type Source = ProtocolSource<unknown>;
type Coverage =
  | Pick<Extract<Source, { kind: 'live' }>, 'kind' | 'coverage'>
  | Pick<Extract<Source, { kind: 'sealed' }>, 'kind' | 'seal'>;

export function sealFooter(
  coverage: Coverage,
  pollId: string,
  locale: Locale,
  messages: Pick<typeof en, 'seal' | 'sealStatus'>
): Content {
  const t = messages.seal.pdf;
  const labels = messages.sealStatus;

  if (coverage.kind === 'live') {
    return {
      text:
        coverage.coverage === 'preliminary'
          ? t.preliminary
          : labels[coverage.coverage],
      bold: true,
    };
  }

  const { rootDigest, status } = coverage.seal;
  const anchor =
    status.kind === 'bitcoin'
      ? labels.bitcoin.replace('{height}', String(status.height)).replace(
          '{date}',
          new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeZone: 'UTC',
          }).format(new Date(status.time))
        )
      : labels[status.kind];
  const url =
    SITE_ORIGIN + '/' + locale + '/verify/' + encodeURIComponent(pollId);

  return {
    columns: [
      {
        width: '*',
        stack: [
          { text: t.digest, bold: true },
          { text: rootDigest },
          { text: anchor },
          { text: t.coverage, margin: [0, 2, 0, 2] },
          {
            text: [
              { text: t.verifyAt + ' · ' },
              { text: url, link: url, decoration: 'underline' },
            ],
          },
        ],
      },
      { width: 64, qr: url, fit: 62, alignment: 'right' },
    ],
    columnGap: 12,
  };
}

export function protocolPageFooter(
  labels: { pageOf: string; generatedOn: string },
  evidence?: Content
): Pick<TDocumentDefinitions, 'footer' | 'pageMargins'> {
  const date = new Date().toISOString().split('T')[0];

  return {
    pageMargins: [40, 40, 40, evidence ? 112 : 40],
    footer: (page, total) => ({
      stack: [
        ...(evidence ? [evidence] : []),
        {
          columns: [
            {
              text: labels.pageOf
                .replace('{current}', String(page))
                .replace('{total}', String(total)),
            },
            {
              text: labels.generatedOn.replace('{date}', date),
              alignment: 'right',
            },
          ],
          margin: [0, 6, 0, 0],
        },
      ],
      margin: [40, 5, 40, 0],
      fontSize: 8,
      color: '#404040',
    }),
  };
}
