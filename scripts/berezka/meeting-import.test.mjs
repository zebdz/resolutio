/** Verify what an operator sees for native meetings and their evidence before publication. */
import { expect, it } from 'vitest';
import { planMeetings } from './meeting-import.mjs';

const run = new Date('2026-11-22T10:00:00Z');

it('preserves recorded Moscow dates and identifies the origin of each missing meeting date', () => {
  const polls = [
    { id: 1, type_of_poll: 1, start: '2022-02-03 13:00:00' },
    { id: 2, type_of_poll: 2, finished: '2022-03-01 01:30:00' },
    { id: 3, type_of_poll: 1, finished: '2026-11-24 13:00:00' },
  ];
  const result = planMeetings(
    { rows: { polls, questions: [] }, assets: [] },
    run
  );
  expect(
    result.meetings.map((m) => [m.start, m.startSource, m.end, m.endSource])
  ).toEqual([
    ['2022-02-03T10:00:00.000Z', 'recorded', run.toISOString(), 'import'],
    [
      '2022-02-27T22:30:00.000Z',
      'dayBeforeFinish',
      '2022-02-28T22:30:00.000Z',
      'recorded',
    ],
    [run.toISOString(), 'import', '2026-11-24T10:00:00.000Z', 'recorded'],
  ]);
});

it('assigns files to their original questions and groups protocol editions in one linked report', () => {
  const rows = {
    polls: [1, 2, 5, 7].map((type) => ({
      id: type,
      type_of_poll: type,
      start: '2021-01-01 12:00:00',
    })),
    questions: [
      { id: 20, poll_id: 2, public: 1 },
      { id: 21, poll_id: 2, public: 0 },
    ],
  };
  const assets = [
    { kind: 'question_file', poll: 2, question: 20, file: 101 },
    { kind: 'question_file', poll: 2, question: 21, file: 102 },
    { kind: 'protocol', poll: 2, sha256: 'pdf' },
    { kind: 'protocol_doc', poll: 2, sha256: 'doc' },
    { kind: 'unassigned', poll: 2, sha256: 'unknown' },
    { kind: 'question_file', poll: 5, question: 50, file: 103 },
    { kind: 'question_file', poll: 7, question: 70, file: 104 },
  ];
  const { meetings } = planMeetings({ rows, assets }, run);
  expect(meetings.map((m) => m.sourceId)).toEqual([1, 2]);
  expect(meetings[0].protocolReport).toBeNull();
  expect(meetings[1].questionFiles).toEqual([
    { key: 'file-101', question: 20 },
    { key: 'file-102', question: 21 },
  ]);
  expect(meetings[1]).not.toHaveProperty('publicQuestionFiles');
  expect(meetings[1].protocolReport).toEqual({
    visibility: 'WITHIN_BOARDS',
    files: ['protocol-2-pdf', 'protocol_doc-2-doc'],
  });
});

it('retains a Word-only protocol and leaves an unassigned PDF outside the report', () => {
  const data = {
    rows: {
      polls: [{ id: 85, type_of_poll: 1, start: '2022-02-02 15:00:00' }],
      questions: [],
    },
    assets: [
      { kind: 'protocol_doc', poll: 85, sha256: 'word' },
      { kind: 'unassigned', poll: 85, sha256: 'pdf' },
    ],
  };
  expect(planMeetings(data, run).meetings[0].protocolReport).toEqual({
    visibility: 'WITHIN_ORG_ONLY',
    files: ['protocol_doc-85-word'],
  });
});

it('links a work report only to eligible meetings explicitly referenced in its content', async () => {
  const { planReports } = await import('./native-import.mjs');
  const rows = {
    polls: [1, 2, 5, 7].map((type) => ({ id: type, type_of_poll: type })),
    questions: [
      { id: 10, poll_id: 1, text: 'Meeting question' },
      {
        id: 50,
        poll_id: 5,
        text: 'https://berezka.decision.community/polls/view/question/10/form_public https://berezka.decision.community/polls/2/results',
      },
      { id: 70, poll_id: 7, text: 'Standalone', public: 1 },
    ],
  };
  const reports = planReports({ rows, assets: [] });
  expect(reports.map((r) => [r.sourceId, r.meetings])).toEqual([
    [50, [1]],
    [70, []],
  ]);
});
