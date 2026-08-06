import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { User } from '@/domain/user/User';

export interface ProtocolSignerEntry {
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  phoneNumber: string | null;
}

export interface ProtocolSignersPdfData {
  organizationName: string;
  boardName: string | null;
  pollTitle: string;
  entries: ProtocolSignerEntry[];
}

export interface ProtocolSignersPdfTranslations {
  title: string;
  organization: string;
  board: string;
  pollName: string;
  willingSection: string;
  notWillingSection: string;
  columnNumber: string;
  columnFullName: string;
  columnPhone: string;
  pageOf: string;
  generatedOn: string;
}

function formatFullName(entry: ProtocolSignerEntry): string {
  return User.formatFullName(entry.firstName, entry.lastName, entry.middleName);
}

function buildSignersTable(
  entries: ProtocolSignerEntry[],
  sectionTitle: string,
  t: ProtocolSignersPdfTranslations,
  showPhone: boolean
): Content {
  if (entries.length === 0) {
    return { text: '' };
  }

  const tableHeader = [
    {
      text: t.columnNumber,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
    { text: t.columnFullName, style: 'tableHeader' },
  ];

  if (showPhone) {
    tableHeader.push({ text: t.columnPhone, style: 'tableHeader' });
  }

  const tableRows = entries.map((entry, i) => {
    const row = [
      { text: String(i + 1), alignment: 'center' as const },
      { text: formatFullName(entry) },
    ];

    if (showPhone) {
      row.push({ text: entry.phoneNumber ?? '' });
    }

    return row;
  });

  const widths: (string | number)[] = showPhone ? [30, '*', 110] : [30, '*'];

  return {
    stack: [
      {
        text: sectionTitle,
        style: 'subheader',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        table: {
          headerRows: 1,
          widths,
          body: [tableHeader, ...tableRows],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
    ],
  };
}

export function buildProtocolSignersPdfDefinition(
  data: ProtocolSignersPdfData,
  t: ProtocolSignersPdfTranslations
): TDocumentDefinitions {
  const content: Content[] = [];

  // Title
  content.push({
    text: t.title,
    style: 'header',
    alignment: 'center',
    margin: [0, 0, 0, 20],
  });

  // Info
  const infoLines: Content[] = [
    {
      text: [
        { text: `${t.organization}: `, bold: true },
        data.organizationName,
      ],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
  ];

  if (data.boardName) {
    infoLines.push({
      text: [{ text: `${t.board}: `, bold: true }, data.boardName],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    });
  }

  infoLines.push({
    text: [{ text: `${t.pollName}: `, bold: true }, data.pollTitle],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  });

  content.push(...infoLines);

  // Willing table — phones shown, since these voters consented to sharing them
  const willing = data.entries.filter((e) => e.willingToSignProtocol);
  content.push(buildSignersTable(willing, t.willingSection, t, true));

  // Not willing table — names only, no phone column
  const notWilling = data.entries.filter((e) => !e.willingToSignProtocol);
  content.push(buildSignersTable(notWilling, t.notWillingSection, t, false));

  return {
    content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
    },
    styles: {
      header: {
        fontSize: 16,
        bold: true,
      },
      subheader: {
        fontSize: 13,
        bold: true,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
      },
    },
    footer: (currentPage: number, pageCount: number) => {
      const pageText = t.pageOf
        .replace('{current}', String(currentPage))
        .replace('{total}', String(pageCount));

      const dateText = t.generatedOn.replace(
        '{date}',
        new Date().toISOString().split('T')[0]
      );

      return {
        columns: [
          {
            text: pageText,
            alignment: 'left' as const,
            margin: [40, 0, 0, 0] as [number, number, number, number],
          },
          {
            text: dateText,
            alignment: 'right' as const,
            margin: [0, 0, 40, 0] as [number, number, number, number],
          },
        ],
        fontSize: 8,
        color: '#888888',
      };
    },
  };
}
