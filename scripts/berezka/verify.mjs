/** Independently reproduce PHP totals from package rows and reconcile materialized destination evidence. */
import { verifyNative } from './native-import.mjs';
import { isDeepStrictEqual as equal } from 'node:util';
import { verifyAccess } from './verify-access.mjs';
import { assetKey, historyKey, questionContent } from './content.mjs';
import { orgId, packageDigest, sourceVotingWeights } from './preflight.mjs';

// The reviewed snapshot has Moscow wall-clock meeting dates from 2021 onward (UTC+03)
// and UTC vote timestamps. Verify these independently of the SQL that performs conversion.
export function checkHistoricalDates(rows, imported, polls, votes) {
  const byPoll = new Map(polls.map((p) => [p.id, p]));
  const byVote = new Map(votes.map((v) => [v.id, v]));

  return (
    rows.polls.every((p) => {
      const actual = byPoll.get(historyKey('poll', p.id));
      const time = p.finished
        ? Date.parse(p.finished.replace(' ', 'T') + '+03:00')
        : +imported;

      return (
        actual?.finish_from_import === !p.finished && +actual.finished === time
      );
    }) &&
    rows.votes.every((v) => {
      const actual = byVote.get(historyKey('vote', v.id));
      const recorded = v.created_at ?? v.updated_at;
      const time = recorded
        ? Date.parse(recorded.replace(' ', 'T') + 'Z')
        : +imported;

      return actual?.cast_from_import === !recorded && +actual.cast_at === time;
    })
  );
}

export function sourceResults(rows) {
  const weight = sourceVotingWeights(rows);
  const tally = new Map(
    rows.answers.map((a) => [
      a.id,
      {
        id: a.id,
        question_id: a.question_id,
        ballots: 0,
        weight: 0,
        percent: 0,
      },
    ])
  );
  const questions = new Map(rows.questions.map((q) => [q.id, q]));
  const voters = new Map(rows.polls.map((p) => [p.id, new Set()]));
  const counts = new Map();

  for (const v of rows.votes) {
    const a = tally.get(v.answer_id);
    a.ballots++;
    a.weight += weight.get(v.user_id) ?? 0;
    counts.set(v.question_id, (counts.get(v.question_id) ?? 0) + 1);
    voters.get(questions.get(v.question_id).poll_id).add(v.user_id);
  }

  for (const a of tally.values()) {
    a.percent =
      Math.round((10000 * a.ballots) / (counts.get(a.question_id) || 1)) / 100;
  }

  const reportPolls = new Set(
    rows.polls.filter((p) => p.type_of_poll === 5).map((p) => p.id)
  );
  const scores = rows.questions
    .filter((q) => reportPolls.has(q.poll_id))
    .map((q) => {
      const sum = rows.answers
        .filter((a) => a.question_id === q.id)
        .reduce((s, a) => s + Number(a.text) * tally.get(a.id).ballots, 0);

      return {
        question_id: q.id,
        score: Math.round(sum / (counts.get(q.id) || 1)),
      };
    });

  return {
    tallies: [...tally.values()],
    scores,
    attendance: [...voters].map(([id, v]) => ({ id, attendance: v.size })),
  };
}

export function restrictedRow(kind, row) {
  if (kind !== 'users') {
    return row;
  }

  const { password, ...evidence } = row;

  return evidence;
}

/** Replay authorized changes in audit order from the original membership flags. */
export function electorateMatches(initial, changes, members) {
  const expected = new Map(initial);

  for (const change of changes) {
    if (expected.get(change.member_id) !== change.was_eligible) {
      return false;
    }

    expected.set(change.member_id, change.eligible);
  }

  return equal(
    expected,
    new Map(members.map((m) => [m.user_id, m.voting_eligible]))
  );
}

export async function verify(db, data, { publishing = false } = {}) {
  const { rows, assets } = data;
  const result = await db.query(
    'select digest,mapping_digest,imported_at,published_at,attestation,identity_plan from berezka.import'
  );

  if (
    result.rows[0]?.digest !== packageDigest ||
    !result.rows[0].published_at
  ) {
    return { error: 'Package is not published' };
  }

  const { tallies, scores, attendance } = sourceResults(rows);
  const answers = await db.query(
    'select id,question_id,ballots,weight::float8,percent::float8 from berezka.tallies order by id'
  );

  if (!equal(tallies, answers.rows)) {
    return { error: 'Per-answer tally mismatch' };
  }

  const observedScores = await db.query(
    'select * from berezka.scores order by question_id'
  );

  if (!equal(scores, observedScores.rows)) {
    return { error: 'Report score mismatch' };
  }

  const observedAttendance = await db.query(
    `select p.id,count(distinct v.user_id)::int attendance from berezka.polls p left join berezka.questions q on q.poll_id=p.id left join berezka.votes v on v.question_id=q.id group by p.id order by p.id`
  );

  if (!equal(attendance, observedAttendance.rows)) {
    return { error: 'Attendance mismatch' };
  }

  let records = 0;

  for (const [kind, items] of Object.entries(rows)) {
    const observed = await db.query(
      'select record from berezka.source where kind=$1 order by id',
      [kind]
    );

    if (
      !equal(
        items.map((item) => restrictedRow(kind, item)),
        observed.rows.map((r) => r.record)
      )
    ) {
      return { error: 'Source mismatch in ' + kind };
    }

    records += items.length;
  }

  const observedContent = await db.query(
    'select question_id,title,body,issues from berezka.content order by question_id'
  );

  if (
    !equal(
      rows.questions.map((q) => ({
        question_id: q.id,
        ...questionContent(q, rows, assets),
      })),
      observedContent.rows
    )
  ) {
    return { error: 'Question body/link mismatch' };
  }

  const files =
    await db.query(`select a.key,a.sha256,a.path,a.poll_id,a.question_id,a.caption,a.kind,
    octet_length(b.bytes) size,encode(sha256(b.bytes),'hex') digest from berezka.assets a join berezka.blobs b using(sha256)`);
  const byKey = new Map(files.rows.map((r) => [r.key, r]));

  if (byKey.size !== assets.length) {
    return { error: 'Attachment count mismatch' };
  }

  const captions = new Map(
    rows.question_files.map((f) => [f.id, f.text_for_file])
  );

  for (const a of assets) {
    const f = byKey.get(assetKey(a));

    if (
      !f ||
      f.sha256 !== a.sha256 ||
      f.digest !== a.sha256 ||
      f.size !== a.size ||
      f.path !== a.path ||
      f.poll_id !== a.poll ||
      f.question_id !== (a.question ?? null) ||
      f.caption !== (captions.get(a.file) ?? null) ||
      f.kind !== a.kind
    ) {
      return { error: 'Attachment mismatch' };
    }
  }

  const mapped = await db.query(
    'select legacy_id,user_id,created from berezka.accounts order by legacy_id'
  );

  if (
    !equal(
      mapped.rows.map((a) => a.legacy_id),
      rows.users.map((u) => u.id)
    )
  ) {
    return { error: 'Account mapping mismatch' };
  }

  const initial = result.rows[0].identity_plan;

  if (
    initial.length !== mapped.rowCount ||
    initial.some(
      (d, i) =>
        mapped.rows[i].legacy_id !== d.legacyId ||
        mapped.rows[i].user_id !==
          (d.targetId ?? 'berezka-user-' + d.legacyId) ||
        mapped.rows[i].created !== (d.action === 'create')
    )
  ) {
    return { error: 'Account resolutions changed' };
  }

  if (publishing) {
    const profiles =
      await db.query(`select a.legacy_id,u.first_name,u.last_name,u.middle_name,u.email,u.email_confirmed_at,u.phone_number,
      u.password,u.confirmed_at,u.created_at at time zone 'UTC' created_at,u.consent_given_at,u.privacy_setup_completed,u.allow_find_by_address,u.allow_find_by_name,
      u.allow_find_by_phone,ad.one_line,ad.street,ad.city,ad.country,ad.is_private_house,u.nickname,u.language
      from users u left join addresses ad on ad.user_id=u.id join berezka.accounts a on a.user_id=u.id where a.created order by a.legacy_id`);
    const originals = new Map(rows.users.map((u) => [u.id, u]));
    const decisions = new Map(initial.map((d) => [d.legacyId, d]));

    for (const p of profiles.rows) {
      const u = originals.get(p.legacy_id);
      const decision = decisions.get(p.legacy_id);
      const correction = decision.createContact;
      const full = [p.last_name, p.first_name, p.middle_name]
        .filter(Boolean)
        .join(' ');

      if (
        full !== u.name.split('(')[0].trim().replace(/\s+/g, ' ') ||
        p.phone_number !== (correction?.phone ?? '+7' + u.phone) ||
        p.email !==
          (correction ? null : u.email?.trim().toLowerCase() || null) ||
        p.email_confirmed_at !== null ||
        Boolean(p.confirmed_at) !== (u.id !== 117 && !correction) ||
        p.password !== 'bcrypt:' + u.password ||
        p.consent_given_at !== null ||
        p.language !== 'ru' ||
        p.nickname !== decision.nickname ||
        !p.allow_find_by_address ||
        !p.allow_find_by_name ||
        !p.allow_find_by_phone ||
        !p.privacy_setup_completed ||
        p.one_line !== u.address ||
        !p.street ||
        p.country !== 'Россия' ||
        p.city !== 'Ростов-на-Дону' ||
        p.is_private_house !== null ||
        new Date(p.created_at).getTime() !==
          Date.parse(u.created_at.replace(' ', 'T') + 'Z')
      ) {
        return {
          error:
            'New account profile mismatch at publication for legacy ID ' + u.id,
        };
      }
    }
  }

  const mappedId = new Map(mapped.rows.map((r) => [r.legacy_id, r.user_id]));
  const members = await db.query(
    "select user_id from organization_users where organization_id=$1 and status='accepted' order by user_id",
    [orgId]
  );
  const admins = await db.query(
    'select user_id from organization_admin_users where organization_id=$1',
    [orgId]
  );
  const board = await db.query(
    "select user_id from board_users where board_id='berezka-board' and removed_at is null"
  );
  const creator = await db.query(
    'select created_by_id from organizations where id=$1',
    [orgId]
  );
  const sameIds = (query, ids) =>
    equal(
      query.rows.map((r) => r.user_id).sort(),
      ids.map((id) => mappedId.get(id)).sort()
    );

  if (
    !sameIds(
      members,
      rows.users.map((u) => u.id)
    ) ||
    !sameIds(admins, [1, 155, 283]) ||
    !sameIds(board, [5, 221, 255]) ||
    creator.rows[0]?.created_by_id !== mappedId.get(1)
  ) {
    return { error: 'Membership or role mismatch' };
  }

  const electorate = await db.query(
    "select user_id,voting_eligible from organization_users where organization_id=$1 and status='accepted'",
    [orgId]
  );
  const changes = await db.query(
    'select member_id,was_eligible,eligible from membership_eligibility_changes where organization_id=$1 order by id',
    [orgId]
  );
  const initialFlags = new Map(
    rows.users.map((u) => [
      mappedId.get(u.id),
      u.permissions.split(',').includes('voter'),
    ])
  );

  if (!electorateMatches(initialFlags, changes.rows, electorate.rows)) {
    return { error: 'Electorate mismatch' };
  }

  const polls = await db.query(
    'select p.id,p.finished,p.finish_from_import from historical_polls p where batch_id=$1',
    [historyKey('batch', 1)]
  );
  const votes = await db.query(
    'select v.id,v.cast_at,v.cast_from_import from historical_votes v join historical_questions q on q.id=v.question_id join historical_polls p on p.id=q.poll_id where p.batch_id=$1',
    [historyKey('batch', 1)]
  );

  if (
    !checkHistoricalDates(
      rows,
      result.rows[0].imported_at,
      polls.rows,
      votes.rows
    )
  ) {
    return { error: 'Historical timestamp or provenance mismatch' };
  }

  const access = await verifyAccess(db, data, mappedId);

  if (access.error) {
    return access;
  }

  const native = await verifyNative(db, data);

  if (native.error) {
    return native;
  }

  return {
    verified: true,
    users: mapped.rowCount,
    records,
    questions: rows.questions.length,
    answers: tallies.length,
    votes: rows.votes.length,
    attendance: attendance.length,
    scores: scores.length,
    reports: native.contentReports + native.protocolReports,
    ...native,
    assets: byKey.size,
    packageDigest,
  };
}
