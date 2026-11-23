/** Formats the named register, holdings and question votes with the record verification footer. */
import { leadingAnswer, printWeight } from '@/web/lib/protocolWeight';
import { protocolPageFooter } from './sealFooter';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

export interface NamedProtocolPdfHolding {
  propertyName: string;
  assetName: string;
  size: number;
  sizeUnitKey: string;
  share: number;
}

export interface NamedProtocolPdfPerson {
  userId: string;
  fullName: string;
  weight: number;
  holdings: NamedProtocolPdfHolding[];
}

export interface NamedProtocolPdfAnswer {
  answerId?: string;
  answerText: string;
  voteCount: number;
  totalWeight: number;
  exactWeight?: string;
  percentage: number;
  voters: Array<{ userId: string; weight: number }>;
}

export interface NamedProtocolPdfQuestion {
  winningAnswerId?: string | null;
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  totalVotes: number;
  totalWeight: number;
  exactTotalWeight?: string;
  answers: NamedProtocolPdfAnswer[];
  nonVoterIds: string[];
}

export interface NamedProtocolPdfInput {
  organizationName: string;
  boardName: string | null;
  pollTitle: string;
  pollDescription: string;
  startDate: string;
  endDate: string;
  // True while the poll is still ACTIVE. An unmarked interim document could be
  // mistaken for the final record of a vote that has not finished.
  isPreliminary: boolean;
  isPropertyBased: boolean;
  isOpenPoll: boolean;
  totalParticipants: number;
  totalParticipantWeight: number;
  exactTotalParticipantWeight?: string;
  register: NamedProtocolPdfPerson[];
  questions: NamedProtocolPdfQuestion[];
}

export interface NamedProtocolPdfTranslations {
  title: string;
  preliminary: string;
  organization: string;
  board: string;
  pollName: string;
  description: string;
  period: string;
  register: string;
  columnNumber: string;
  columnFullName: string;
  columnHoldings: string;
  columnWeight: string;
  share: string;
  question: string;
  questionDetails: string;
  questionType: string;
  singleChoice: string;
  multipleChoice: string;
  answerLine: string;
  winnerMark: string;
  didNotVote: string;
  signaturesAndStamps: string;
  chairman: string;
  secretary: string;
  date: string;
  stamp: string;
  pageOf: string;
  generatedOn: string;
  // Pre-resolved 'propertyAdmin.sizeUnit.*' → label. The route flattens the
  // message file into this so the generator stays free of next-intl.
  sizeUnits: Record<string, string>;
}

// The message files use next-intl's {placeholder} syntax, but this generator
// runs outside React and is handed raw strings, so it interpolates itself.
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

// share is Decimal(9,8): 0.5 → "50", 0.3333 → "33.33". No trailing zeros —
// "доля 50%" reads as a legal statement, "доля 50.00%" reads as a spreadsheet.
function formatShare(share: number): string {
  return String(Number((share * 100).toFixed(6)));
}

function formatHoldings(
  holdings: NamedProtocolPdfHolding[],
  t: NamedProtocolPdfTranslations
): string {
  return holdings
    .map((h) => {
      const unit =
        t.sizeUnits[h.sizeUnitKey] ??
        (h.sizeUnitKey.startsWith('propertyAdmin.sizeUnit.')
          ? ''
          : h.sizeUnitKey);
      const base =
        `${h.propertyName}, ${h.assetName}, ${h.size} ${unit}`.trim();

      // A whole asset needs no qualifier; a shared one must say so, because
      // the weight beside it is only that fraction of the area.
      return h.share < 1
        ? `${base}, ${fill(t.share, { percent: formatShare(h.share) })}`
        : base;
    })
    .join('; ');
}

function buildRegisterSection(
  data: NamedProtocolPdfInput,
  t: NamedProtocolPdfTranslations
): Content[] {
  const header = [
    {
      text: t.columnNumber,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
    { text: t.columnFullName, style: 'tableHeader' },
    ...(data.isPropertyBased
      ? [{ text: t.columnHoldings, style: 'tableHeader' }]
      : []),
    {
      text: t.columnWeight,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
  ];

  const rows = data.register.map((person, i) => [
    { text: String(i + 1), alignment: 'center' as const },
    { text: person.fullName },
    ...(data.isPropertyBased
      ? [{ text: formatHoldings(person.holdings, t) }]
      : []),
    { text: printWeight(person.weight), alignment: 'center' as const },
  ]);

  return [
    { text: t.register, style: 'subheader', margin: [0, 0, 0, 8] },
    {
      table: {
        headerRows: 1,
        widths: data.isPropertyBased ? [20, 130, '*', 50] : [20, '*', 50],
        body: [header, ...rows],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 20] as [number, number, number, number],
    },
  ];
}

function buildQuestionSection(
  question: NamedProtocolPdfQuestion,
  index: number,
  registerById: Map<string, NamedProtocolPdfPerson>,
  data: NamedProtocolPdfInput,
  t: NamedProtocolPdfTranslations
): Content {
  const typeLabel =
    question.questionType === 'single-choice'
      ? t.singleChoice
      : t.multipleChoice;

  const winner = leadingAnswer(
    question.questionType,
    question.answers,
    (answer) => answer.totalWeight,
    question.winningAnswerId
  );

  const items: Content[] = [
    {
      text: fill(t.question, {
        number: index + 1,
        text: question.questionText,
      }),
      style: 'questionTitle',
    },
  ];

  if (question.questionDetails) {
    items.push({
      text: `${t.questionDetails}: ${question.questionDetails}`,
      style: 'questionMeta',
    });
  }

  items.push({
    text: `${t.questionType}: ${typeLabel}`,
    style: 'questionMeta',
  });

  question.answers.forEach((answer, i) => {
    const line = fill(t.answerLine, {
      number: i + 1,
      text: answer.answerText,
      votes: answer.voteCount,
      weight: printWeight(answer.totalWeight, answer.exactWeight),
      percentage: answer.percentage.toFixed(2),
    });

    items.push({
      text: winner === answer ? `${line} — ${t.winnerMark}` : line,
      style: 'answerLine',
    });

    // Names are printed here; holdings live once in the register above, so a
    // multi-choice voter under several answers does not repeat them.
    items.push({
      ol: answer.voters.map((v) => {
        const person = registerById.get(v.userId);

        return `${person?.fullName ?? v.userId} — ${printWeight(v.weight)}`;
      }),
      style: 'voterList',
      margin: [15, 0, 0, 6] as [number, number, number, number],
    });
  });

  // An open poll has no fixed electorate, so there is nobody to be absent.
  if (!data.isOpenPoll && question.nonVoterIds.length > 0) {
    items.push({
      text: fill(t.didNotVote, { count: question.nonVoterIds.length }),
      style: 'answerLine',
    });
    items.push({
      ol: question.nonVoterIds.map((userId) => {
        const person = registerById.get(userId);

        return `${person?.fullName ?? userId} — ${printWeight(person?.weight ?? 0)}`;
      }),
      style: 'voterList',
      margin: [15, 0, 0, 6] as [number, number, number, number],
    });
  }

  return {
    stack: items,
    margin: [0, 10, 0, 0] as [number, number, number, number],
  };
}

export function buildNamedProtocolPdfDefinition(
  data: NamedProtocolPdfInput,
  t: NamedProtocolPdfTranslations,
  evidence?: Content
): TDocumentDefinitions {
  const content: Content[] = [];

  content.push({
    text: data.isPreliminary ? `${t.title}  [${t.preliminary}]` : t.title,
    style: 'header',
    alignment: 'center',
    margin: [0, 0, 0, 20],
  });

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

  infoLines.push(
    {
      text: [{ text: `${t.pollName}: `, bold: true }, data.pollTitle],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: [{ text: `${t.description}: `, bold: true }, data.pollDescription],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: [
        { text: `${t.period}: `, bold: true },
        `${data.startDate} — ${data.endDate}`,
      ],
      margin: [0, 0, 0, 15] as [number, number, number, number],
    }
  );

  content.push(...infoLines);
  content.push(...buildRegisterSection(data, t));

  const registerById = new Map(data.register.map((p) => [p.userId, p]));

  data.questions.forEach((q, i) => {
    content.push(buildQuestionSection(q, i, registerById, data, t));
  });

  // Signature block, laid out the same way the results protocol does it.
  content.push({
    stack: [
      {
        text: t.signaturesAndStamps,
        style: 'subheader',
        margin: [0, 30, 0, 15] as [number, number, number, number],
      },
      {
        columns: [
          { text: `${t.chairman}: ________________`, width: '50%' },
          { text: `${t.date}: ____________`, width: '50%' },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        columns: [
          { text: `${t.secretary}: ________________`, width: '50%' },
          { text: `${t.date}: ____________`, width: '50%' },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: `${t.stamp}:` },
    ],
    unbreakable: true,
  });

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
      questionTitle: {
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 3],
      },
      questionMeta: {
        fontSize: 9,
        color: '#555555',
        margin: [0, 0, 0, 3],
      },
      answerLine: {
        fontSize: 10,
        bold: true,
        margin: [0, 6, 0, 3],
      },
      voterList: {
        fontSize: 9,
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
      },
    },
    ...protocolPageFooter(t, evidence),
  };
}
