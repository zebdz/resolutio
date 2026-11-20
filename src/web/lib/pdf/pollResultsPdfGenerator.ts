/** Builds a printable poll-results protocol from authorized plain DTOs.
 * Question kinds retain domain vocabulary; translated labels remain display text. */
import { leadingAnswer, printWeight } from '@/web/lib/protocolWeight';
import { protocolPageFooter } from './sealFooter';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import type { QuestionType } from '@/src/domain/poll/QuestionType';

export interface PdfAnswerData {
  answerId?: string;
  answerText: string;
  voteCount: number;
  weightedVotes: number;
  exactWeight?: string;
  percentage: number;
}

export interface PdfQuestionData {
  winningAnswerId?: string | null;
  questionText: string;
  questionDetails: string | null;
  questionType: QuestionType;
  totalVotes: number;
  totalWeight: number;
  exactTotalWeight?: string;
  answers: PdfAnswerData[];
}

export interface PdfInputData {
  organizationName: string;
  boardName: string | null;
  pollTitle: string;
  pollDescription: string;
  startDate: string;
  endDate: string;
  totalParticipants: number;
  votedParticipants: number;
  totalWeight: number;
  exactTotalWeight?: string;
  weightOfVoted: number;
  exactWeightOfVoted?: string;
  questions: PdfQuestionData[];
}

export interface PdfTranslations {
  protocol: string;
  organization: string;
  board: string;
  pollName: string;
  description: string;
  period: string;
  summary: string;
  totalParticipants: string;
  votedParticipants: string;
  totalWeight: string;
  weightOfVoted: string;
  questionNumber: string;
  questionType: string;
  questionDetails: string;
  votedOnQuestion: string;
  weightOfVotedOnQuestion: string;
  answerNumber: string;
  answerText: string;
  votes: string;
  weight: string;
  percentage: string;
  winnerColumn: string;
  winnerMark: string;
  signaturesAndStamps: string;
  chairman: string;
  secretary: string;
  date: string;
  stamp: string;
  pageOf: string;
  generatedOn: string;
  singleChoice: string;
  multipleChoice: string;
}

function buildQuestionSection(
  question: PdfQuestionData,
  index: number,
  t: PdfTranslations
): Content {
  const typeLabel =
    question.questionType === 'single-choice'
      ? t.singleChoice
      : t.multipleChoice;

  const questionTitle = t.questionNumber.replace('{number}', String(index + 1));

  const winner = leadingAnswer(
    question.questionType,
    question.answers,
    (answer) => answer.weightedVotes,
    question.winningAnswerId
  );

  const headerItems: Content[] = [
    {
      text: `${questionTitle}: ${question.questionText}`,
      style: 'questionTitle',
    },
  ];

  if (question.questionDetails) {
    headerItems.push({
      text: `${t.questionDetails}: ${question.questionDetails}`,
      style: 'questionMeta',
    });
  }

  headerItems.push({
    text: `${t.questionType}: ${typeLabel}  |  ${t.votedOnQuestion}: ${question.totalVotes}  |  ${t.weightOfVotedOnQuestion}: ${printWeight(question.totalWeight, question.exactTotalWeight)}`,
    style: 'questionMeta',
  });

  // Answer table
  const tableHeader = [
    {
      text: t.answerNumber,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
    { text: t.answerText, style: 'tableHeader' },
    { text: t.votes, style: 'tableHeader', alignment: 'center' as const },
    { text: t.weight, style: 'tableHeader', alignment: 'center' as const },
    { text: t.percentage, style: 'tableHeader', alignment: 'center' as const },
    {
      text: t.winnerColumn,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
  ];

  const tableRows = question.answers.map((answer, i) => {
    const isWinner = winner === answer;

    return [
      { text: String(i + 1), alignment: 'center' as const },
      { text: answer.answerText },
      { text: String(answer.voteCount), alignment: 'center' as const },
      {
        text: printWeight(answer.weightedVotes, answer.exactWeight),
        alignment: 'center' as const,
      },
      {
        text: answer.percentage.toFixed(2) + '%',
        alignment: 'center' as const,
      },
      {
        text: isWinner ? t.winnerMark : '',
        alignment: 'center' as const,
      },
    ];
  });

  return {
    unbreakable: true,
    stack: [
      ...headerItems,
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 40, 50, 40, 65],
          body: [tableHeader, ...tableRows],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 5, 0, 15] as [number, number, number, number],
      },
    ],
    margin: [0, 10, 0, 0] as [number, number, number, number],
  };
}

export function buildPdfDocumentDefinition(
  data: PdfInputData,
  t: PdfTranslations,
  evidence?: Content
): TDocumentDefinitions {
  const content: Content[] = [];

  // Title
  content.push({
    text: t.protocol,
    style: 'header',
    alignment: 'center',
    margin: [0, 0, 0, 20],
  });

  // Org + board + poll info
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

  // Summary
  content.push({
    text: t.summary,
    style: 'subheader',
    margin: [0, 0, 0, 8],
  });

  content.push({
    columns: [
      {
        text: [
          { text: `${t.totalParticipants}: `, bold: true },
          String(data.totalParticipants),
        ],
      },
      {
        text: [
          { text: `${t.votedParticipants}: `, bold: true },
          String(data.votedParticipants),
        ],
      },
    ],
    margin: [0, 0, 0, 3] as [number, number, number, number],
  });

  content.push({
    columns: [
      {
        text: [
          { text: `${t.totalWeight}: `, bold: true },
          printWeight(data.totalWeight, data.exactTotalWeight),
        ],
      },
      {
        text: [
          { text: `${t.weightOfVoted}: `, bold: true },
          printWeight(data.weightOfVoted, data.exactWeightOfVoted),
        ],
      },
    ],
    margin: [0, 0, 0, 20] as [number, number, number, number],
  });

  // Questions
  data.questions.forEach((q, i) => {
    content.push(buildQuestionSection(q, i, t));
  });

  // Keep the signature lines together in the flow above the verification footer.
  content.push({
    unbreakable: true,
    margin: [0, 16, 0, 8],
    stack: [
      {
        text: t.signaturesAndStamps,
        style: 'subheader',
        margin: [0, 0, 0, 15] as [number, number, number, number],
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
      {
        text: `${t.stamp}:`,
        margin: [0, 0, 0, 0] as [number, number, number, number],
      },
    ],
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
      tableHeader: {
        bold: true,
        fontSize: 9,
      },
    },
    ...protocolPageFooter(t, evidence),
  };
}

export async function generatePdfBuffer(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  // Lazy import to avoid loading fonts during tests
  const { printer } = await import('./pdfFonts');
  // pdfmake v0.3: createPdfKitDocument returns a Promise<PDFDocument>
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
