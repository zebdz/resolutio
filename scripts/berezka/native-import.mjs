/** Publish reviewed meetings, named ballots and reports through the native storage model.
 * Source identity translation and legacy link interpretation stay entirely in the importer. */
import { historyKey, assetKey, questionContent } from './content.mjs';
import { planMeetings } from './meeting-import.mjs';
import { attachMeetingEvidence } from './meeting-evidence.mjs';
import { orgId } from './preflight.mjs';
import { extname } from 'node:path';

const nativeId = (kind, key) => historyKey(kind, key).slice(5);
const reportTypes = new Set([5, 7]);
const mimeTypes = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const utc = (value) => (value ? value.replace(' ', 'T') + 'Z' : null);

/** Translate meeting records from the package. A private account crosswalk resolves legacy_user at insert. */
export function nativeBallots(data, pollIds, importedAt) {
  const questions = data.rows.questions
    .filter((q) => pollIds.has(q.poll_id))
    .map((q) => ({
      id: nativeId('question', q.id),
      poll_id: pollIds.get(q.poll_id),
      position: q.position_in_poll,
      ...questionContent(q, data.rows, data.assets),
      created: utc(q.created_at),
    }));
  const ids = new Set(questions.map((q) => q.id));
  const answers = data.rows.answers
    .filter((a) => ids.has(nativeId('question', a.question_id)))
    .map((a) => ({
      id: nativeId('answer', a.id),
      question_id: nativeId('question', a.question_id),
      source_order: a.id,
      label: a.text,
    }));
  const votes = data.rows.votes
    .filter((v) => ids.has(nativeId('question', v.question_id)))
    .map((v) => ({
      id: nativeId('vote', v.id),
      question_id: nativeId('question', v.question_id),
      answer_id: nativeId('answer', v.answer_id),
      legacy_user: v.user_id,
      cast_at: utc(v.created_at ?? v.updated_at) ?? importedAt.toISOString(),
    }));

  return { questions, answers, votes };
}

export function planReports({ rows, assets }) {
  const parents = new Map(rows.polls.map((p) => [p.id, p]));
  const targets = new Map(
    rows.polls.map((p) => [historyKey('poll', p.id), p.id])
  );

  for (const q of rows.questions) {
    targets.set(historyKey('question', q.id), q.poll_id);
  }

  return rows.questions
    .filter((q) => reportTypes.has(parents.get(q.poll_id)?.type_of_poll))
    .map((q) => {
      const { title, body } = questionContent(q, rows, assets);
      const meetings = new Set();

      for (const link of body.matchAll(
        /\]\(\/polls\/(?:questions\/)?(hist_[0-9a-f]{32})(?:\/results)?\)/g
      )) {
        const parent = parents.get(targets.get(link[1]));

        // WITHIN_ORG_ONLY reports may formally cite finished organization-wide polls.
        // Keep board-question references in the source text for readers with access.
        if (parent?.type_of_poll === 1) {
          meetings.add(parent.id);
        }
      }

      return {
        sourceId: q.id,
        author: q.author,
        created: utc(q.created_at),
        collection:
          parents.get(q.poll_id)?.type_of_poll === 5
            ? parents.get(q.poll_id).name
            : null,
        meetings: [...meetings],
        title,
        body,
      };
    });
}

async function publishReports(db, data, pollIds) {
  const reports = planReports(data);
  const attachments = [];
  const links = [];
  const filesByQuestion = Map.groupBy(
    data.assets.filter((a) => ['inline', 'question_file'].includes(a.kind)),
    (a) => a.question
  );

  for (const report of reports) {
    const id = nativeId('question', report.sourceId);

    for (const meeting of report.meetings) {
      links.push({ report: id, poll: pollIds.get(meeting) });
    }

    for (const asset of filesByQuestion.get(report.sourceId) ?? []) {
      const key = assetKey(asset);
      const original =
        '/api/historical-attachments/' + historyKey('asset', key);
      const mime = asset.mime ?? mimeTypes[extname(asset.path).toLowerCase()];
      const max = mime?.startsWith('image/')
        ? 5 * 1024 * 1024
        : 10 * 1024 * 1024;

      if (!Object.values(mimeTypes).includes(mime) || asset.size > max) {
        // Keep unsupported media and oversized originals available through the authenticated archive.
        if (!report.body.includes(original)) {
          report.body += '\n\n[Файл из архива](' + original + ')';
        }

        continue;
      }

      const fileId = nativeId('asset', key);
      report.body = report.body.replaceAll(
        original,
        '/api/report-attachments/' + fileId
      );
      attachments.push({ id: fileId, report: id, key, mime });
    }
  }

  await db.query(
    `insert into reports(id,organization_id,created_by_id,title,body,visibility,state,published_by_id,last_published_at,created_at,updated_at)
     select x.id,o.id,a.user_id,left(btrim(x.title),200),concat_ws(E'\n\n',x.collection,x.body,
       case when s.score is not null then 'Оценка: '||s.score end,'[Архивная запись](/polls/questions/hist_'||x.id||')'),
       'WITHIN_ORG_ONLY','PUBLISHED',o.created_by_id,i.imported_at,coalesce(x.created,i.imported_at),i.imported_at
     from jsonb_to_recordset($1::jsonb) x(id text,source_id int,author int,created timestamptz,collection text,title text,body text)
     join berezka.accounts a on a.legacy_id=x.author left join berezka.scores s on s.question_id=x.source_id
     cross join berezka.import i join organizations o on o.id=$2`,
    [
      JSON.stringify(
        reports.map((r) => ({
          ...r,
          id: nativeId('question', r.sourceId),
          source_id: r.sourceId,
        }))
      ),
      orgId,
    ]
  );
  await db.query(
    `insert into report_attachments(id,report_id,file_name,mime_type,size_bytes,bytes,created_at)
     select x.id,x.report,regexp_replace(a.path,'^.*/',''),x.mime,octet_length(b.bytes),b.bytes,i.imported_at
     from jsonb_to_recordset($1::jsonb) x(id text,report text,key text,mime text)
     join berezka.assets a using(key) join berezka.blobs b using(sha256) cross join berezka.import i`,
    [JSON.stringify(attachments)]
  );
  await db.query(
    'insert into report_polls(report_id,poll_id) select report,poll from jsonb_to_recordset($1::jsonb) x(report text,poll text)',
    [JSON.stringify(links)]
  );
}

export async function publishNative(db, data) {
  const {
    rows: [run],
  } = await db.query('select imported_at from berezka.import');
  const mapping = planMeetings(data, run.imported_at);

  if (mapping.error) {
    return mapping;
  }

  const {
    rows: [owner],
  } = await db.query('select created_by_id from organizations where id=$1', [
    orgId,
  ]);
  const pollIds = new Map(
    mapping.meetings.map((m) => [m.sourceId, nativeId('poll', m.sourceId)])
  );
  const ballots = nativeBallots(data, pollIds, run.imported_at);
  const meetingsById = new Map(data.rows.polls.map((p) => [p.id, p]));
  const byPoll = Map.groupBy(ballots.questions, (q) => q.poll_id);
  const byQuestion = Map.groupBy(ballots.votes, (v) => v.question_id);

  for (const m of mapping.meetings) {
    const provenance = [
      m.startSource === 'dayBeforeFinish'
        ? 'Дата начала условная: за день до окончания.'
        : m.startSource === 'import'
          ? 'Начало указано по дате импорта.'
          : null,
      m.endSource === 'import' ? 'Окончание указано по дате импорта.' : null,
    ]
      .filter(Boolean)
      .join(' ');
    const pollId = pollIds.get(m.sourceId);
    const parent = meetingsById.get(m.sourceId);
    const questions = byPoll.get(pollId) ?? [];
    const attendees = new Set(
      questions.flatMap((q) =>
        (byQuestion.get(q.id) ?? []).map((v) => v.legacy_user)
      )
    );
    const description = [
      provenance,
      'Участники по архиву: ' +
        attendees.size +
        ' / ' +
        parent.potential_voters_number,
      '[Архивный реестр голосов](/api/historical-results/hist_' + pollId + ')',
      questions
        .filter((q) => q.body.length > 500)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map(
          (q) =>
            '[Полный текст вопроса ' +
            q.position +
            '](/polls/questions/hist_' +
            q.id +
            ')'
        )
        .join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
    await db.query(
      `insert into polls(id,title,description,organization_id,board_id,start_date,end_date,state,created_by,created_at)
       values($1,$2,$3,$4,$5,$6,$7,'FINISHED',$8,$9)`,
      [
        pollId,
        parent.name,
        description,
        orgId,
        parent.type_of_poll === 2 ? 'berezka-board' : null,
        m.start,
        m.end,
        owner.created_by_id,
        utc(parent.created_at) ?? run.imported_at,
      ]
    );
  }

  await db.query(
    `insert into questions(id,poll_id,text,details,"order",created_at)
     select q.id,p.id,btrim(q.title),case when char_length(btrim(q.body))<=500 then nullif(btrim(q.body),'')
       else 'Полный текст вопроса приведён в материалах собрания.' end,
       row_number() over(partition by p.id order by q.position nulls last,q.id)-1,coalesce(q.created,p.created_at)
     from jsonb_to_recordset($1::jsonb) q(id text,poll_id text,title text,body text,position int,created timestamptz)
     join polls p on p.id=q.poll_id`,
    [JSON.stringify(ballots.questions)]
  );
  await db.query(
    `insert into answers(id,question_id,text,"order",created_at)
     select a.id,q.id,btrim(a.label),row_number() over(partition by q.id order by a.source_order)-1,q.created_at
     from jsonb_to_recordset($1::jsonb) a(id text,question_id text,label text,source_order int) join questions q on q.id=a.question_id`,
    [JSON.stringify(ballots.answers)]
  );
  // The established maintenance override is transaction-local and is scoped to the one insert.
  await db.query("set local app.allow_immutable_mutation='on'");
  await db.query(
    `insert into votes(id,question_id,answer_id,user_id,user_weight,created_at)
     select v.id,v.question_id,v.answer_id,a.user_id,1,v.cast_at
     from jsonb_to_recordset($1::jsonb) v(id text,question_id text,answer_id text,legacy_user int,cast_at timestamptz)
     join berezka.accounts a on a.legacy_id=v.legacy_user`,
    [JSON.stringify(ballots.votes)]
  );
  await db.query("set local app.allow_immutable_mutation='off'");
  await db.query(
    `insert into poll_participants(id,poll_id,user_id,user_weight,snapshot_at,created_at)
     select gen_random_uuid()::text,q.poll_id,v.user_id,1,min(v.created_at),min(v.created_at) from votes v
     join questions q on q.id=v.question_id where q.poll_id=any($1::text[]) group by q.poll_id,v.user_id`,
    [[...pollIds.values()]]
  );
  const evidence = await attachMeetingEvidence(
    db,
    mapping.meetings,
    pollIds,
    owner.created_by_id
  );

  if (evidence.error) {
    return evidence;
  }

  await publishReports(db, data, pollIds);

  return { published: true };
}

/** Reconcile destination rows with the reviewed snapshot on first publication and every repeat apply. */
export async function verifyNative(db, data) {
  const {
    rows: [run],
  } = await db.query('select imported_at from berezka.import');
  const mapping = planMeetings(data, run.imported_at);

  if (mapping.error) {
    return mapping;
  }

  const expectedPolls = mapping.meetings.map((m) => ({
    id: nativeId('poll', m.sourceId),
    start: m.start,
    end: m.end,
  }));
  const pollIds = new Map(
    mapping.meetings.map((m) => [m.sourceId, nativeId('poll', m.sourceId)])
  );
  const ballots = nativeBallots(data, pollIds, run.imported_at);
  const reportPlan = planReports(data);
  const reportIds = reportPlan.map((r) => nativeId('question', r.sourceId));
  const {
    rows: [counts],
  } = await db.query(
    `with meetings as (select p.* from polls p where id=any($1::text[])),
     wanted as (select v.id,v.question_id,v.answer_id,a.user_id,v.cast_at::timestamp(3) created_at,1::numeric user_weight
        from jsonb_to_recordset($4::jsonb) v(id text,question_id text,answer_id text,legacy_user int,cast_at timestamptz)
        join berezka.accounts a on a.legacy_id=v.legacy_user),
     wanted_questions as (select id,poll_id,btrim(title),row_number() over(partition by poll_id order by position nulls last,id)-1
       from jsonb_to_recordset($6::jsonb) x(id text,poll_id text,title text,position int)),
     actual_questions as (select q.id,q.poll_id,q.text,q."order" from questions q join meetings m on q.poll_id=m.id),
     wanted_answers as (select id,question_id,btrim(label),row_number() over(partition by question_id order by source_order)-1
       from jsonb_to_recordset($7::jsonb) x(id text,question_id text,label text,source_order int)),
     actual_answers as (select a.id,a.question_id,a.text,a."order" from answers a join actual_questions q on q.id=a.question_id),
     actual as (select v.id,v.question_id,v.answer_id,v.user_id,v.created_at,v.user_weight from votes v
        join questions q on q.id=v.question_id join meetings m on m.id=q.poll_id),
     participants as (select p.* from poll_participants p join meetings m on m.id=p.poll_id),
     attendance as (select distinct q.poll_id,v.user_id from actual v join questions q on q.id=v.question_id),
     reports_in_scope as (select r.* from reports r where r.id=any($5::text[])),
     protocols as (select r.*,m.board_id from meetings m join report_polls l on l.poll_id=m.id
       join reports r on r.id=l.report_id where not exists(select from reports_in_scope s where s.id=r.id))
     select (select count(*)::int from meetings m join jsonb_to_recordset($2::jsonb) x(id text,start timestamptz,"end" timestamptz)
       on m.id=x.id and m.start_date=x.start and m.end_date=x."end" where m.state='FINISHED' and m.finished_at is null
       and m.organization_id=$3 and m.poll_type='ORGANIZATION' and not m.anonymous and m.distribution_type='EQUAL') "meetings",
       (select count(*)::int from actual) "meetingVotes",
       (select count(*)::int from actual_questions) "meetingQuestions",
       (select count(*)::int from actual_answers) "meetingAnswers",
       exists((table wanted_questions except all table actual_questions) union all (table actual_questions except all table wanted_questions)) question_drift,
       exists((table wanted_answers except all table actual_answers) union all (table actual_answers except all table wanted_answers)) answer_drift,
       exists((table wanted except all table actual) union all (table actual except all table wanted)) ballot_drift,
       exists((table attendance except select poll_id,user_id from participants) union all
         (select poll_id,user_id from participants except table attendance)) participant_drift,
       exists(select from participants where user_weight<>1 or receipt_secret is not null or ballot_snapshot is not null
          or willing_to_sign_protocol is not null) receipt_drift,
       (select count(*)::int from reports_in_scope where visibility='WITHIN_ORG_ONLY' and state='PUBLISHED'
          and organization_id=$3 and not notify_audience) "contentReports",
       (select count(*)::int from protocols r where r.organization_id=$3 and r.state='PUBLISHED' and not r.notify_audience and
         ((r.board_id is null and r.visibility='WITHIN_ORG_ONLY') or (r.visibility='WITHIN_BOARDS' and
          exists(select from report_boards b where b.report_id=r.id and b.board_id=r.board_id)))) "protocolReports"`,
    [
      Array.from(pollIds.values()),
      JSON.stringify(expectedPolls),
      orgId,
      JSON.stringify(ballots.votes),
      reportIds,
      JSON.stringify(ballots.questions),
      JSON.stringify(ballots.answers),
    ]
  );
  const expectedLinks = reportPlan
    .flatMap((r) =>
      r.meetings.map((m) =>
        [nativeId('question', r.sourceId), nativeId('poll', m)].join('/')
      )
    )
    .sort();
  const actualLinks = await db.query(
    `select l.report_id||'/'||l.poll_id link from report_polls l
    where l.report_id=any($1::text[])`,
    [reportIds]
  );
  const links = actualLinks.rows.map((r) => r.link).sort();

  if (
    counts.meetings !== 26 ||
    counts.meetingVotes !== 5601 ||
    counts.question_drift ||
    counts.answer_drift ||
    counts.ballot_drift ||
    counts.participant_drift ||
    counts.receipt_drift ||
    counts.contentReports !== 339 ||
    counts.protocolReports !== 25 ||
    JSON.stringify(links) !== JSON.stringify(expectedLinks)
  ) {
    return {
      error:
        'Native meeting, ballot, participant or report reconciliation failed',
    };
  }

  // Compare file hashes per owner, preserving duplicate references and authenticated
  // archive links for file formats and sizes outside the native upload contract.
  const reportSources = new Set(reportPlan.map((r) => r.sourceId));
  const expectedFiles = data.assets.flatMap((a) => {
    if (['alternate', 'unassigned'].includes(a.kind)) {
      return [];
    }

    const key = historyKey('asset', assetKey(a));

    if (reportSources.has(a.question)) {
      return [
        {
          owner: nativeId('question', a.question),
          kind: 'report',
          key,
          sha256: a.sha256,
        },
      ];
    }

    const poll = pollIds.get(a.poll);

    if (!poll) {
      return [];
    }

    const questionFile = ['inline', 'question_file'].includes(a.kind);

    return [
      {
        owner: questionFile ? nativeId('question', a.question) : poll,
        kind: questionFile ? 'poll' : 'protocol',
        key,
        sha256: a.sha256,
      },
    ];
  });
  const files = await db.query(
    `with expected as (select * from jsonb_to_recordset($1::jsonb) x(owner text, kind text, key text, sha256 text)),
    actual as (select a.question_id owner,'poll' kind,encode(sha256(a.bytes),'hex') digest from poll_attachments a where a.poll_id=any($2::text[])
       union all select l.poll_id,'protocol',encode(sha256(a.bytes),'hex') from report_polls l
         join report_attachments a on a.report_id=l.report_id where l.poll_id=any($2::text[]) and not(l.report_id=any($3::text[]))
       union all select a.report_id,'report',encode(sha256(a.bytes),'hex') from report_attachments a where a.report_id=any($3::text[])
       union all select r.id,'report',x.sha256 from expected x join reports r on r.id=x.owner and x.kind='report'
         where strpos(r.body,'/api/historical-attachments/'||x.key)>0 and not exists(select from report_attachments a where a.id=substr(x.key,6) and a.report_id=r.id)),
    wanted as (select owner, kind, sha256 from expected)
    select exists((table wanted except all table actual) union all (table actual except all table wanted)) mismatch`,
    [JSON.stringify(expectedFiles), Array.from(pollIds.values()), reportIds]
  );

  if (files.rows[0].mismatch) {
    return { error: 'Native attachment digest or owner mismatch' };
  }

  return {
    meetings: counts.meetings,
    meetingVotes: counts.meetingVotes,
    meetingQuestions: counts.meetingQuestions,
    meetingAnswers: counts.meetingAnswers,
    contentReports: counts.contentReports,
    protocolReports: counts.protocolReports,
    reportMeetingLinks: links.length,
  };
}

// The previous dev importer emitted a numbered Markdown list in manifest order.
// Validate each original link and its file hash before moving the existing row.
export async function restoreQuestionOwners(db, data) {
  const {
    rows: [run],
  } = await db.query('select imported_at from berezka.import');
  const plan = planMeetings(data, run.imported_at);

  if (plan.error) {
    return plan;
  }

  for (const meeting of plan.meetings) {
    const poll = nativeId('poll', meeting.sourceId);
    const {
      rows: [parent],
    } = await db.query('select description from polls where id=$1 for update', [
      poll,
    ]);
    const entries = [
      ...parent.description.matchAll(
        /^- \[Файл (\d+)\]\(\/api\/poll-attachments\/([a-zA-Z0-9_-]+)\)$/gm
      ),
    ];

    if (entries.length !== meeting.questionFiles.length) {
      return { error: 'Previous meeting attachment list differs' };
    }

    for (const [i, entry] of entries.entries()) {
      const { key, question } = meeting.questionFiles[i];
      const result = await db.query(
        `update poll_attachments f set question_id=$1 from berezka.assets a
        where f.id=$2 and f.poll_id=$3 and f.question_id is null and a.key=$4 and a.question_id=$5
          and encode(sha256(f.bytes),'hex')=a.sha256`,
        [nativeId('question', question), entry[2], poll, key, question]
      );

      if (Number(entry[1]) !== i + 1 || result.rowCount !== 1) {
        return { error: 'Previous question attachment differs' };
      }
    }

    if (entries.length) {
      const suffix = entries.map((m) => m[0]).join('\n');

      if (!parent.description.endsWith(suffix)) {
        return { error: 'Meeting description changed after import' };
      }

      await db.query('update polls set description=$1 where id=$2', [
        parent.description.slice(0, -suffix.length).trimEnd(),
        poll,
      ]);
    }
  }

  return { published: true };
}
