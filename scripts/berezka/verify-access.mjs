/** Derive allowed source keys independently from destination SQL and exercise every archive access predicate. */
import { isDeepStrictEqual } from 'node:util';
import { assetKey, historyKey } from './content.mjs';

export function expectedAccess(data, role, legacyId) {
  const { polls, questions } = data.rows;
  const parents = new Set(
    polls
      .filter((p) => {
        if (role === 'anonymous') {
          return false;
        }

        if (role === 'admin') {
          return true;
        }

        if (p.type_of_poll === 6) {
          return questions.some(
            (q) =>
              q.poll_id === p.id && (!q.is_editing || q.author === legacyId)
          );
        }

        return true;
      })
      .map((p) => p.id)
  );
  const visible = new Set(
    questions.filter((q) => parents.has(q.poll_id)).map((q) => q.id)
  );
  const assets = data.assets
    .filter(
      (a) =>
        !(
          role === 'member' &&
          polls.some((p) => p.id === a.poll && p.type_of_poll === 2)
        ) &&
        a.kind !== 'alternate' &&
        a.kind !== 'unassigned' &&
        (a.question ? visible.has(a.question) : parents.has(a.poll))
    )
    .map(assetKey)
    .sort();

  return { polls: [...parents], questions: [...visible], assets };
}

export async function verifyAccess(db, data, mapped) {
  for (const [role, id] of [
    ['anonymous', null],
    ['member', 94],
    ['board', 5],
    ['admin', 1],
  ]) {
    const viewer = mapped.get(id) ?? null;
    const expected = expectedAccess(data, role, id);
    const expectedKeys = {
      polls: expected.polls.map((key) => historyKey('poll', key)).sort(),
      questions: expected.questions
        .map((key) => historyKey('question', key))
        .sort(),
      assets: expected.assets.map((key) => historyKey('asset', key)).sort(),
    };
    const actual = await db.query(
      `select
       array(select p.id from historical_polls p where batch_id=$2 and historical_can_poll($1,p.id) order by p.id collate "C") polls,
       array(select q.id from historical_questions q join historical_polls p on p.id=q.poll_id where batch_id=$2 and historical_can_question($1,q.id) order by q.id collate "C") questions,
       array(select a.key from historical_assets a join historical_polls p on p.id=a.poll_id where batch_id=$2 and historical_can_asset($1,a.key) order by a.key collate "C") assets`,
      [viewer, historyKey('batch', 1)]
    );

    if (!isDeepStrictEqual(actual.rows[0], expectedKeys)) {
      return { error: 'Archive permissions mismatch for ' + role };
    }
  }

  return { verified: true };
}
