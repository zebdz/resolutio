import { describe, it, expect } from 'vitest';
import {
  buildNamedProtocolPdfDefinition,
  NamedProtocolPdfInput,
  NamedProtocolPdfTranslations,
} from './namedProtocolPdfGenerator';

const t: NamedProtocolPdfTranslations = {
  title: 'ПОИМЁННЫЙ ПРОТОКОЛ',
  preliminary: 'ПРЕДВАРИТЕЛЬНЫЙ',
  organization: 'Организация',
  board: 'Орган управления',
  pollName: 'Голосование',
  description: 'Описание',
  period: 'Период',
  register: 'РЕЕСТР УЧАСТНИКОВ',
  columnNumber: '№',
  columnFullName: 'ФИО',
  columnHoldings: 'Собственность',
  columnWeight: 'Вес',
  share: 'доля {percent}%',
  question: 'Вопрос {number}. {text}',
  questionDetails: 'Пояснение',
  questionType: 'Тип вопроса',
  singleChoice: 'одиночный выбор',
  multipleChoice: 'множественный выбор',
  answerLine:
    '{number}. {text} — голосов: {votes}, вес {weight} ({percentage}%)',
  winnerMark: 'принято',
  didNotVote: 'Не голосовали ({count})',
  signaturesAndStamps: 'ПОДПИСИ И ПЕЧАТИ',
  chairman: 'Председатель',
  secretary: 'Секретарь',
  date: 'Дата',
  stamp: 'М.П.',
  pageOf: 'Стр. {current} из {total}',
  generatedOn: 'Сформировано: {date}',
  sizeUnits: { 'propertyAdmin.sizeUnit.squareMeters': 'м²' },
};

function baseData(
  overrides: Partial<NamedProtocolPdfInput> = {}
): NamedProtocolPdfInput {
  return {
    organizationName: 'ТСЖ Гвардейское',
    boardName: null,
    pollTitle: 'Бюджет 2026',
    pollDescription: 'Описание',
    startDate: '2026-01-15',
    endDate: '2026-02-15',
    isPreliminary: false,
    isPropertyBased: false,
    isOpenPoll: false,
    totalParticipants: 2,
    totalParticipantWeight: 3,
    register: [
      { userId: 'user-1', fullName: 'Иванов И. И.', weight: 2, holdings: [] },
      { userId: 'user-2', fullName: 'Петров П. С.', weight: 1, holdings: [] },
    ],
    questions: [
      {
        questionText: 'Утвердить бюджет?',
        questionDetails: null,
        questionType: 'single-choice',
        totalVotes: 1,
        totalWeight: 2,
        answers: [
          {
            answerText: 'Да',
            voteCount: 1,
            totalWeight: 2,
            percentage: 66.67,
            voters: [{ userId: 'user-1', weight: 2 }],
          },
          {
            answerText: 'Нет',
            voteCount: 0,
            totalWeight: 0,
            percentage: 0,
            voters: [],
          },
        ],
        nonVoterIds: ['user-2'],
      },
    ],
    ...overrides,
  };
}

const dump = (d: unknown) => JSON.stringify(d);

describe('buildNamedProtocolPdfDefinition', () => {
  it('names the voters under the answer they chose', () => {
    const doc = dump(buildNamedProtocolPdfDefinition(baseData(), t));

    expect(doc).toContain('Иванов И. И.');
    expect(doc).toContain('Утвердить бюджет?');
    expect(doc).toContain('Вопрос 1. Утвердить бюджет?');
  });

  it('renders the answer line with counts, weight and percentage', () => {
    const doc = dump(buildNamedProtocolPdfDefinition(baseData(), t));

    expect(doc).toContain('1. Да — голосов: 1, вес 2.00 (66.67%)');
  });

  it('lists the non-voters with a count', () => {
    const doc = dump(buildNamedProtocolPdfDefinition(baseData(), t));

    expect(doc).toContain('Не голосовали (1)');
    expect(doc).toContain('Петров П. С.');
  });

  it('omits the non-voter block for an open poll', () => {
    const doc = dump(
      buildNamedProtocolPdfDefinition(baseData({ isOpenPoll: true }), t)
    );

    expect(doc).not.toContain('Не голосовали');
  });

  it('omits the non-voter block when everyone voted', () => {
    const data = baseData();
    data.questions[0].nonVoterIds = [];

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'Не голосовали'
    );
  });

  it('marks a preliminary export', () => {
    expect(
      dump(
        buildNamedProtocolPdfDefinition(baseData({ isPreliminary: true }), t)
      )
    ).toContain('ПРЕДВАРИТЕЛЬНЫЙ');
  });

  it('leaves a finished export unmarked', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).not.toContain(
      'ПРЕДВАРИТЕЛЬНЫЙ'
    );
  });

  it('omits the holdings column for a non-property poll', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).not.toContain(
      'Собственность'
    );
  });

  it('renders holdings with the translated unit', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 738',
        size: 64,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 1,
      },
    ];

    const doc = dump(buildNamedProtocolPdfDefinition(data, t));

    expect(doc).toContain('Собственность');
    expect(doc).toContain('Дом Гвардейский 13, кв. 738, 64 м²');
    expect(doc).not.toContain('доля');
  });

  it('joins several holdings with a semicolon', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 738',
        size: 64,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 1,
      },
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 737',
        size: 43,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 1,
      },
    ];

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).toContain(
      'Дом Гвардейский 13, кв. 738, 64 м²; Дом Гвардейский 13, кв. 737, 43 м²'
    );
  });

  it('appends a share suffix only for partial ownership', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 0.5,
      },
    ];

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).toContain(
      'доля 50%'
    );
  });

  it('renders an awkward share without trailing zeros', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 0.3333,
      },
    ];

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).toContain(
      'доля 33.33%'
    );
  });

  it('falls back to an empty unit when the key is unknown', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnitKey: 'propertyAdmin.sizeUnit.parsecs',
        share: 1,
      },
    ];

    const doc = dump(buildNamedProtocolPdfDefinition(data, t));

    expect(doc).toContain('Дом Гвардейский 13, кв. 12, 18');
    expect(doc).not.toContain('propertyAdmin.sizeUnit');
  });

  it('marks the unique single-choice winner', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).toContain(
      'принято'
    );
  });

  it('marks no winner on a tie', () => {
    const data = baseData();
    data.questions[0].answers[1].totalWeight = 2;
    data.questions[0].answers[1].voteCount = 1;

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'принято'
    );
  });

  it('marks no winner on a multiple-choice question', () => {
    const data = baseData();
    data.questions[0].questionType = 'multiple-choice';

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'принято'
    );
  });

  it('marks no winner when nobody voted at all', () => {
    const data = baseData();
    data.questions[0].answers.forEach((a) => {
      a.totalWeight = 0;
      a.voteCount = 0;
      a.voters = [];
    });

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'принято'
    );
  });

  it('includes the board only when the poll has one', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).not.toContain(
      'Орган управления'
    );
    expect(
      dump(
        buildNamedProtocolPdfDefinition(baseData({ boardName: 'Правление' }), t)
      )
    ).toContain('Правление');
  });

  it('includes question details when present', () => {
    const data = baseData();
    data.questions[0].questionDetails = 'Смета на 2026 год';

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).toContain(
      'Смета на 2026 год'
    );
  });

  it('carries the signature block and a page footer', () => {
    const doc = buildNamedProtocolPdfDefinition(baseData(), t);

    expect(dump(doc)).toContain('Председатель');
    expect(dump(doc)).toContain('М.П.');
    expect(typeof doc.footer).toBe('function');
  });
});
