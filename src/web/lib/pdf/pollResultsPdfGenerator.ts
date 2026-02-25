import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

export interface PdfAnswerData {
  answerText: string;
  voteCount: number;
  weightedVotes: number;
  percentage: number;
}

export interface PdfQuestionData {
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  totalVotes: number;
  totalWeight: number;
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
  weightOfVoted: number;
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

function determineWinner(
  answers: PdfAnswerData[],
  questionType: string
): PdfAnswerData | null {
  if (questionType !== 'single-choice') {
    return null;
  }

  if (answers.length === 0) {
    return null;
  }

  const maxWeight = Math.max(...answers.map((a) => a.weightedVotes));
  const top = answers.filter((a) => a.weightedVotes === maxWeight);

  return top.length === 1 ? top[0] : null;
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

  const winner = determineWinner(question.answers, question.questionType);

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
    text: `${t.questionType}: ${typeLabel}  |  ${t.votedOnQuestion}: ${question.totalVotes}  |  ${t.weightOfVotedOnQuestion}: ${question.totalWeight.toFixed(2)}`,
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
    const isWinner = winner && answer.answerText === winner.answerText;

    return [
      { text: String(i + 1), alignment: 'center' as const },
      { text: answer.answerText },
      { text: String(answer.voteCount), alignment: 'center' as const },
      { text: answer.weightedVotes.toFixed(2), alignment: 'center' as const },
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
  t: PdfTranslations
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
          String(data.totalWeight),
        ],
      },
      {
        text: [
          { text: `${t.weightOfVoted}: `, bold: true },
          String(data.weightOfVoted),
        ],
      },
    ],
    margin: [0, 0, 0, 20] as [number, number, number, number],
  });

  // Questions
  data.questions.forEach((q, i) => {
    content.push(buildQuestionSection(q, i, t));
  });

  // Reserve space at bottom of last page for signatures
  // A4: 841.89pt height, 40pt margins → content bottom at y=801.89
  // Signatures block ~170pt → starts at y=632
  const signaturesHeight = 170;
  const signaturesY = 632;

  content.push({
    text: ' ',
    margin: [0, signaturesHeight, 0, 0] as [number, number, number, number],
  });

  // Signatures pinned to bottom of last page
  content.push({
    absolutePosition: { x: 40, y: signaturesY },
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
  } as any);

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
