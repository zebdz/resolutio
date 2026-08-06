import { describe, it, expect } from 'vitest';
import {
  buildProtocolSignersPdfDefinition,
  ProtocolSignersPdfData,
  ProtocolSignersPdfTranslations,
} from './protocolSignersPdfGenerator';

const t: ProtocolSignersPdfTranslations = {
  title: 'PROTOCOL SIGNING WILLINGNESS',
  organization: 'Organization',
  board: 'Board',
  pollName: 'Poll',
  willingSection: 'WILLING TO SIGN',
  notWillingSection: 'NOT WILLING TO SIGN',
  columnNumber: '#',
  columnFullName: 'Full Name',
  columnPhone: 'Phone',
  pageOf: 'Page {current} of {total}',
  generatedOn: 'Generated: {date}',
};

function makeData(
  overrides: Partial<ProtocolSignersPdfData> = {}
): ProtocolSignersPdfData {
  return {
    organizationName: 'Test Org',
    boardName: null,
    pollTitle: 'Annual Vote',
    entries: [
      {
        firstName: 'Alice',
        lastName: 'Smith',
        middleName: null,
        willingToSignProtocol: true,
        phoneNumber: '+79001234567',
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        middleName: null,
        willingToSignProtocol: false,
        phoneNumber: null,
      },
    ],
    ...overrides,
  };
}

// The two section tables are the only `table` nodes in the document, in order:
// willing first, then not-willing.
function findTables(content: any): any[] {
  const tables: any[] = [];

  const walk = (node: any) => {
    if (Array.isArray(node)) {
      node.forEach(walk);

      return;
    }

    if (node && typeof node === 'object') {
      if (node.table) {
        tables.push(node.table);
      }

      if (node.stack) {
        walk(node.stack);
      }
    }
  };

  walk(content);

  return tables;
}

describe('buildProtocolSignersPdfDefinition', () => {
  it('willing table has a phone column with the localized header', () => {
    const doc = buildProtocolSignersPdfDefinition(makeData(), t);
    const [willingTable] = findTables(doc.content);

    expect(willingTable.body[0]).toHaveLength(3);
    expect(JSON.stringify(willingTable.body[0])).toContain('Phone');
    expect(JSON.stringify(willingTable.body[1])).toContain('+79001234567');
  });

  it('not-willing table has no phone column and no phone data', () => {
    const doc = buildProtocolSignersPdfDefinition(makeData(), t);
    const [, notWillingTable] = findTables(doc.content);

    expect(notWillingTable.body[0]).toHaveLength(2);
    expect(JSON.stringify(notWillingTable)).not.toContain('Phone');
    expect(JSON.stringify(notWillingTable)).not.toContain('+7');
    expect(JSON.stringify(notWillingTable)).toContain('Johnson');
  });

  it('never prints a phone for someone who declined, even if one is set', () => {
    const doc = buildProtocolSignersPdfDefinition(
      makeData({
        entries: [
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            middleName: null,
            willingToSignProtocol: false,
            phoneNumber: '+79007654321',
          },
        ],
      }),
      t
    );

    expect(JSON.stringify(doc.content)).not.toContain('+79007654321');
  });

  it('renders no willing table when nobody is willing', () => {
    const doc = buildProtocolSignersPdfDefinition(
      makeData({
        entries: [
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            middleName: null,
            willingToSignProtocol: false,
            phoneNumber: null,
          },
        ],
      }),
      t
    );

    expect(findTables(doc.content)).toHaveLength(1);
  });
});
