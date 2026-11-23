/** Archive read model keeps ballot evidence separate from report projections. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { questionContent } from './content.mjs';

test('Draft formatting, lists and verified crosswalk targets survive conversion', () => {
  const draft = {
    blocks: [
      {
        type: 'unordered-list-item',
        depth: 0,
        text: 'Read this',
        inlineStyleRanges: [{ offset: 0, length: 4, style: 'BOLD' }],
        entityRanges: [{ offset: 5, length: 4, key: 0 }],
      },
    ],
    entityMap: {
      0: {
        type: 'LINK',
        data: {
          url: 'https://berezka.decision.community/polls/view/question/12/form_public',
        },
      },
    },
  };
  const q = { id: 12, text: JSON.stringify(draft) };
  const content = questionContent(q, { questions: [q], polls: [] }, []);
  assert.match(
    content.body,
    /^- \*\*Read\*\* \[this\]\(\/polls\/questions\/hist_[0-9a-f]{32}\)$/
  );
});

test('independent source totals use per-answer counts, rights, PHP rounding and deduplicated attendance', async () => {
  const { sourceResults } = await import('./verify.mjs');
  const rows = {
    questions: [{ id: 3, poll_id: 1 }],
    polls: [{ id: 1, type_of_poll: 5 }],
    answers: [
      { id: 4, question_id: 3, text: '3' },
      { id: 5, question_id: 3, text: '4' },
    ],
    votes: [
      { id: 8, user_id: 1, question_id: 3, answer_id: 4 },
      { id: 9, user_id: 2, question_id: 3, answer_id: 5 },
    ],
    rights: [{ id: 10, type_of_right: 1, weight: 3, number_of_share: 0.5 }],
    right_user: [{ right_id: 10, user_id: 2 }],
  };
  const r = sourceResults(rows);
  assert.deepEqual(r.tallies, [
    { id: 4, question_id: 3, ballots: 1, weight: 0, percent: 50 },
    { id: 5, question_id: 3, ballots: 1, weight: 1.5, percent: 50 },
  ]);
  assert.deepEqual(r.scores, [{ question_id: 3, score: 4 }]);
  assert.deepEqual(r.attendance, [{ id: 1, attendance: 2 }]);
});

test('plain legacy links are resolved and unresolved archival form URLs cannot autolink', () => {
  const q = {
    id: 2,
    text: 'See https://berezka.decision.community/polls/85/results and https://berezka.decision.community/check-parent',
  };
  const body = questionContent(q, { questions: [q], polls: [{ id: 85 }] }, []);
  assert.match(body.body, /\]\(\/polls\/hist_[0-9a-f]{32}\/results\)/);
  assert.ok(
    !body.body.includes('https://berezka.decision.community/check-parent')
  );
  assert.equal(body.issues.length, 1);
});

test('an old public flag grants no access outside the organization', async () => {
  const { expectedAccess } = await import('./verify-access.mjs');
  const data = {
    rows: {
      polls: [{ id: 97, type_of_poll: 5 }],
      questions: [
        { id: 1, poll_id: 97, public: 1 },
        { id: 2, poll_id: 97, public: 0 },
      ],
    },
    assets: [
      { kind: 'question_file', file: 1, question: 1, poll: 97 },
      { kind: 'unassigned', poll: 97, sha256: 'abc' },
    ],
  };
  assert.deepEqual(expectedAccess(data, 'anonymous').questions, []);
  assert.deepEqual(expectedAccess(data, 'member').questions, [1, 2]);
  assert.deepEqual(expectedAccess(data, 'anonymous').assets, []);
});

test('reconciliation distinguishes genuine dates from the persisted import time on resume', async () => {
  const { checkHistoricalDates } = await import('./verify.mjs');
  const { historyKey } = await import('./content.mjs');
  const imported = new Date('2026-11-22T18:00:00Z');
  const known = new Date('2020-07-01T09:00:00Z');
  const rows = {
    polls: [
      { id: 85, finished: null },
      { id: 27, finished: '2020-07-01 12:00:00' },
    ],
    votes: [
      { id: 11, created_at: null, updated_at: null },
      { id: 12, created_at: '2020-07-01 09:00:00', updated_at: null },
    ],
  };
  const polls = [
    {
      id: historyKey('poll', 85),
      finished: imported,
      finish_from_import: true,
    },
    { id: historyKey('poll', 27), finished: known, finish_from_import: false },
  ];
  const votes = [
    { id: historyKey('vote', 11), cast_at: imported, cast_from_import: true },
    { id: historyKey('vote', 12), cast_at: known, cast_from_import: false },
  ];
  assert.equal(checkHistoricalDates(rows, imported, polls, votes), true);
  assert.equal(
    checkHistoricalDates(rows, new Date('2026-11-23T18:00:00Z'), polls, votes),
    false
  );
  assert.equal(
    checkHistoricalDates(rows, imported, polls, [
      { ...votes[0], cast_from_import: false },
      votes[1],
    ]),
    false
  );
});

test('maps an original street alone or a building with a spaced letter, fraction or structure', async () => {
  const { parseLegacyAddress } = await import('./apply.mjs');

  for (const building of [null, '12', '12а', '12 а', '12/4', '12 стр2']) {
    const line = 'Лесная' + (building ? ' ' + building : '');
    assert.deepEqual(parseLegacyAddress(line), { street: 'Лесная', building });
  }
});
