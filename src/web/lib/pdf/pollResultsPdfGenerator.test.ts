import { describe, it, expect } from 'vitest';
import {
  buildPdfDocumentDefinition,
  PdfInputData,
  PdfTranslations,
} from './pollResultsPdfGenerator';

const baseTranslations: PdfTranslations = {
  protocol: 'POLL RESULTS PROTOCOL',
  organization: 'Organization',
  board: 'Board',
  pollName: 'Poll',
  description: 'Description',
  period: 'Period',
  summary: 'SUMMARY',
  totalParticipants: 'Total Participants',
  votedParticipants: 'Voted',
  totalWeight: 'Total Weight',
  weightOfVoted: 'Weight of Voted',
  questionNumber: 'Question {number}',
  questionType: 'Type',
  questionDetails: 'Details',
  votedOnQuestion: 'Voted',
  weightOfVotedOnQuestion: 'Weight',
  answerNumber: '#',
  answerText: 'Answer',
  votes: 'Votes',
  weight: 'Weight',
  percentage: '%',
  winnerColumn: 'Winner',
  winnerMark: '+',
  signaturesAndStamps: 'SIGNATURES AND STAMPS',
  chairman: 'Chairman',
  secretary: 'Secretary',
  date: 'Date',
  stamp: 'Stamp',
  pageOf: 'Page {current} of {total}',
  generatedOn: 'Generated: {date}',
  singleChoice: 'Single Choice',
  multipleChoice: 'Multiple Choice',
};

function makeData(overrides: Partial<PdfInputData> = {}): PdfInputData {
  return {
    organizationName: 'Test Org',
    boardName: null,
    pollTitle: 'Annual Vote',
    pollDescription: 'A test poll',
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    totalParticipants: 10,
    votedParticipants: 8,
    totalWeight: 100,
    weightOfVoted: 80,
    questions: [
      {
        questionText: 'Who should lead?',
        questionDetails: null,
        questionType: 'single-choice',
        totalVotes: 8,
        totalWeight: 80,
        answers: [
          {
            answerText: 'Alice',
            voteCount: 5,
            weightedVotes: 50,
            percentage: 50,
          },
          {
            answerText: 'Bob',
            voteCount: 3,
            weightedVotes: 30,
            percentage: 30,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function stringify(doc: any): string {
  return JSON.stringify(doc);
}

function findInContent(content: any[], text: string): boolean {
  const s = JSON.stringify(content);

  return s.includes(text);
}

function flattenContent(node: any): any[] {
  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(flattenContent);
  }

  if (node && typeof node === 'object') {
    const result: any[] = [];

    if (node.text !== undefined) {
      if (Array.isArray(node.text)) {
        result.push(...node.text.flatMap(flattenContent));
      } else {
        result.push(node.text);
      }
    }

    if (node.columns) {
      result.push(...node.columns.flatMap(flattenContent));
    }

    if (node.stack) {
      result.push(...node.stack.flatMap(flattenContent));
    }

    if (node.table?.body) {
      for (const row of node.table.body) {
        result.push(...row.flatMap(flattenContent));
      }
    }

    if (Array.isArray(node.content)) {
      result.push(...node.content.flatMap(flattenContent));
    }

    return result;
  }

  return [];
}

describe('buildPdfDocumentDefinition', () => {
  it('includes poll title in content', () => {
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('Annual Vote');
  });

  it('includes org name; includes board name when present', () => {
    const data = makeData({
      organizationName: 'My Org',
      boardName: 'Board Alpha',
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('My Org');
    expect(s).toContain('Board Alpha');
  });

  it('omits board line when boardName is null', () => {
    const data = makeData({ boardName: null });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).not.toContain('"Board"');
    expect(s).not.toContain(baseTranslations.board);
  });

  it('includes formatted start/end dates', () => {
    const data = makeData({
      startDate: '2025-03-01',
      endDate: '2025-03-31',
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('2025-03-01');
    expect(s).toContain('2025-03-31');
  });

  it('includes summary stats', () => {
    const data = makeData({
      totalParticipants: 20,
      votedParticipants: 15,
      totalWeight: 200,
      weightOfVoted: 150,
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('20');
    expect(s).toContain('15');
    expect(s).toContain('200');
    expect(s).toContain('150');
  });

  it('generates section per question', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'single-choice',
          totalVotes: 5,
          totalWeight: 50,
          answers: [
            {
              answerText: 'A',
              voteCount: 5,
              weightedVotes: 50,
              percentage: 100,
            },
          ],
        },
        {
          questionText: 'Q2',
          questionDetails: null,
          questionType: 'multiple-choice',
          totalVotes: 3,
          totalWeight: 30,
          answers: [
            {
              answerText: 'B',
              voteCount: 3,
              weightedVotes: 30,
              percentage: 60,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('Q1');
    expect(s).toContain('Q2');
  });

  it('includes question type label', () => {
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('Single Choice');
  });

  it('includes questionDetails when present', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: 'Extra info here',
          questionType: 'single-choice',
          totalVotes: 5,
          totalWeight: 50,
          answers: [
            {
              answerText: 'A',
              voteCount: 5,
              weightedVotes: 50,
              percentage: 100,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('Extra info here');
  });

  it('omits questionDetails when null', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'single-choice',
          totalVotes: 5,
          totalWeight: 50,
          answers: [
            {
              answerText: 'A',
              voteCount: 5,
              weightedVotes: 50,
              percentage: 100,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).not.toContain(baseTranslations.questionDetails);
  });

  it('answer table rows have correct data', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'single-choice',
          totalVotes: 8,
          totalWeight: 80,
          answers: [
            {
              answerText: 'AnswerX',
              voteCount: 5,
              weightedVotes: 50.0,
              percentage: 62.5,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('AnswerX');
    expect(s).toContain('50.00');
    expect(s).toContain('62.50');
  });

  it('marks winner for single-choice (highest weight, no tie)', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'single-choice',
          totalVotes: 8,
          totalWeight: 80,
          answers: [
            {
              answerText: 'Winner',
              voteCount: 5,
              weightedVotes: 50,
              percentage: 62.5,
            },
            {
              answerText: 'Loser',
              voteCount: 3,
              weightedVotes: 30,
              percentage: 37.5,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const texts = flattenContent(doc.content as any[]);
    const allText = texts.join('|');
    // Winner mark should appear exactly once
    const winnerMarks = texts.filter((t) => t === baseTranslations.winnerMark);
    expect(winnerMarks.length).toBe(1);
    // The winner row should be the first answer (highest weight)
    expect(allText).toContain('+');
  });

  it('no winner on tie', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'single-choice',
          totalVotes: 6,
          totalWeight: 60,
          answers: [
            {
              answerText: 'A',
              voteCount: 3,
              weightedVotes: 30,
              percentage: 50,
            },
            {
              answerText: 'B',
              voteCount: 3,
              weightedVotes: 30,
              percentage: 50,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const texts = flattenContent(doc.content as any[]);
    const winnerMarks = texts.filter((t) => t === baseTranslations.winnerMark);
    expect(winnerMarks.length).toBe(0);
  });

  it('no winner for multiple-choice', () => {
    const data = makeData({
      questions: [
        {
          questionText: 'Q1',
          questionDetails: null,
          questionType: 'multiple-choice',
          totalVotes: 8,
          totalWeight: 80,
          answers: [
            {
              answerText: 'A',
              voteCount: 5,
              weightedVotes: 50,
              percentage: 62.5,
            },
            {
              answerText: 'B',
              voteCount: 3,
              weightedVotes: 30,
              percentage: 37.5,
            },
          ],
        },
      ],
    });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const texts = flattenContent(doc.content as any[]);
    const winnerMarks = texts.filter((t) => t === baseTranslations.winnerMark);
    expect(winnerMarks.length).toBe(0);
  });

  it('signature section with Chairman + Secretary lines', () => {
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain(baseTranslations.signaturesAndStamps);
    expect(s).toContain(baseTranslations.chairman);
    expect(s).toContain(baseTranslations.secretary);
    expect(s).toContain(baseTranslations.stamp);
  });

  it('unbreakable: true on question groups', () => {
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    const s = stringify(doc.content);
    expect(s).toContain('"unbreakable":true');
  });

  it('footer has page numbers', () => {
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    expect(doc.footer).toBeDefined();
    // Footer should be a function
    expect(typeof doc.footer).toBe('function');
    // Call it to verify output
    const footerResult = (doc.footer as (...args: any[]) => any)(1, 5);
    const footerStr = stringify(footerResult);
    expect(footerStr).toContain('1');
    expect(footerStr).toContain('5');
  });

  it('handles empty questions array', () => {
    const data = makeData({ questions: [] });
    const doc = buildPdfDocumentDefinition(data, baseTranslations);
    // Should not throw and should still have content
    expect(doc.content).toBeDefined();
    const s = stringify(doc.content);
    // Should still have header, summary, signatures
    expect(s).toContain(baseTranslations.protocol);
    expect(s).toContain(baseTranslations.signaturesAndStamps);
  });

  it('uses translation labels (no hardcoded strings)', () => {
    const custom: PdfTranslations = {
      ...baseTranslations,
      protocol: 'CUSTOM_PROTOCOL',
      summary: 'CUSTOM_SUMMARY',
      signaturesAndStamps: 'CUSTOM_SIGNATURES',
      chairman: 'CUSTOM_CHAIRMAN',
      secretary: 'CUSTOM_SECRETARY',
      organization: 'CUSTOM_ORG_LABEL',
      singleChoice: 'CUSTOM_SINGLE',
    };
    const data = makeData();
    const doc = buildPdfDocumentDefinition(data, custom);
    const s = stringify(doc.content);
    expect(s).toContain('CUSTOM_PROTOCOL');
    expect(s).toContain('CUSTOM_SUMMARY');
    expect(s).toContain('CUSTOM_SIGNATURES');
    expect(s).toContain('CUSTOM_CHAIRMAN');
    expect(s).toContain('CUSTOM_SECRETARY');
    expect(s).toContain('CUSTOM_ORG_LABEL');
    expect(s).toContain('CUSTOM_SINGLE');
  });
});
