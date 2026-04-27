// PDF export for the org Ownership view. Mirrors the polls PDF generator's
// shape (input data → docDefinition → buffer) so Cyrillic + the existing
// pdfmake font setup carry over without reinvention. The PDF intentionally
// captures the user's filtered table state, not the whole DB — exporting
// "what I see" matches the admin's expectation when they hit the button.

import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

export interface OwnershipPdfRow {
  ownerLabel: string;
  sharePercent: number;
  effectiveFrom: string; // ISO date — formatted at PDF build time
  effectiveUntil: string | null; // ISO date or null = active
}

export interface OwnershipPdfGroup {
  propertyName: string;
  assetName: string;
  rows: OwnershipPdfRow[];
}

export interface OwnershipPdfInputData {
  organizationName: string;
  generatedAt: Date;
  // Human-readable summary of the active filters at export time so anyone
  // looking at the PDF later understands which slice of data it represents.
  filterSummary: string;
  groups: OwnershipPdfGroup[];
}

export interface OwnershipPdfTranslations {
  title: string;
  organization: string;
  generatedAt: string;
  filters: string;
  filterActive: string;
  filterAll: string;
  property: string;
  asset: string;
  owner: string;
  share: string;
  from: string;
  until: string;
  active: string;
  empty: string;
}

function formatDate(iso: string, locale: string): string {
  // Wrap in try/catch — invalid dates from the DB shouldn't crash the
  // entire generator; render the raw string instead.
  try {
    return new Date(iso).toLocaleDateString(locale);
  } catch {
    return iso;
  }
}

export function buildOwnershipPdfDocumentDefinition(
  data: OwnershipPdfInputData,
  t: OwnershipPdfTranslations,
  locale: string
): TDocumentDefinitions {
  const content: Content[] = [];

  content.push({
    text: t.title,
    style: 'header',
    alignment: 'center',
    margin: [0, 0, 0, 20],
  });

  content.push(
    {
      text: [
        { text: `${t.organization}: `, bold: true },
        data.organizationName,
      ],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: [
        { text: `${t.generatedAt}: `, bold: true },
        data.generatedAt.toLocaleString(locale),
      ],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: [{ text: `${t.filters}: `, bold: true }, data.filterSummary],
      margin: [0, 0, 0, 14] as [number, number, number, number],
    }
  );

  if (data.groups.length === 0) {
    content.push({ text: t.empty, italics: true, color: '#888888' });
  } else {
    for (const group of data.groups) {
      content.push({
        text: [
          { text: `${group.assetName}`, bold: true, fontSize: 12 },
          {
            text: `   ${t.property}: ${group.propertyName}`,
            color: '#666666',
            fontSize: 9,
          },
        ],
        margin: [0, 8, 0, 4] as [number, number, number, number],
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 60, 80, 80],
          body: [
            [
              { text: t.owner, bold: true },
              { text: t.share, bold: true },
              { text: t.from, bold: true },
              { text: t.until, bold: true },
            ],
            ...group.rows.map((r) => [
              r.ownerLabel,
              `${r.sharePercent.toFixed(2)}%`,
              formatDate(r.effectiveFrom, locale),
              r.effectiveUntil
                ? formatDate(r.effectiveUntil, locale)
                : t.active,
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 6] as [number, number, number, number],
      });
    }
  }

  return {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      header: { fontSize: 18, bold: true },
    },
    pageMargins: [40, 40, 40, 40] as [number, number, number, number],
  };
}

export async function generateOwnershipPdfBuffer(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  const { printer } = await import('./pdfFonts');
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
