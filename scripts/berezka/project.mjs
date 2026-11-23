/** Install the importer checkpoint and read-only access to original supplemental evidence.
 * Polls, ballots and reports are published independently in their native tables. */
import { readFile } from 'node:fs/promises';
import { historyKey } from './content.mjs';
import { orgId } from './preflight.mjs';

const batch = "'" + historyKey('batch', 1) + "'";
// Expressions below are fixed importer SQL. This is the PostgreSQL equivalent of historyKey.
const key = (kind, expression) =>
  `'hist_' || left(encode(sha256(convert_to('decision.community/berezka/${kind}/' || (${expression})::text,'UTF8')),'hex'),32)`;

const records = [
  [
    'imports',
    'id,organization_id,source,imported_at',
    `select ${batch},'${orgId}','decision.community/berezka',imported_at from berezka.import`,
  ],
  [
    'members',
    'batch_id,user_id',
    `select ${batch},user_id from berezka.accounts`,
  ],
  [
    'polls',
    'id,batch_id,kind,board_id,title,created,started,finished,finish_from_import,denominator,attendance',
    `select ${key('poll', 'p.id')},${batch},case p.type when 6 then 'proposal' when 5 then 'collection' when 7 then 'information' else 'meeting' end,
      case when p.type=2 then 'berezka-board' end,p.title,p.created,p.started,coalesce(p.finished,i.imported_at),p.finished is null,p.denominator,
      (select count(distinct v.user_id)::int from berezka.votes v join berezka.questions q on q.id=v.question_id where q.poll_id=p.id)
     from berezka.polls p cross join berezka.import i`,
  ],
  [
    'questions',
    'id,poll_id,position,author_id,author,created,public,editing,report,score,title,body',
    `select ${key('question', 'q.id')},${key('poll', 'q.poll_id')},q.position,a.user_id,n.name,q.created,q.public,q.editing,r.id is not null,s.score,c.title,c.body
     from berezka.questions q join berezka.accounts a on a.legacy_id=q.author join berezka.names n on n.id=q.author join berezka.content c on c.question_id=q.id
     left join berezka.reports r on r.id=q.id left join berezka.scores s on s.question_id=q.id`,
  ],
  [
    'answers',
    'id,question_id,position,label,ballots,weight,percent',
    `select ${key('answer', 'id')},${key('question', 'question_id')},row_number() over(partition by question_id order by id)::int,label,ballots,weight,percent from berezka.tallies`,
  ],
  [
    'votes',
    'id,question_id,answer_id,user_id,name,cast_at,cast_from_import,updated_at',
    `select ${key('vote', 'v.id')},${key('question', 'v.question_id')},${key('answer', 'v.answer_id')},v.user_id,n.name,
     coalesce(v.cast_at,v.updated_at,i.imported_at),v.cast_at is null and v.updated_at is null,v.updated_at
     from berezka.votes v join berezka.names n on n.id=v.legacy_id cross join berezka.import i`,
  ],
  [
    'assets',
    'key,poll_id,question_id,kind,path,caption,mime,sha256',
    `select ${key('asset', 'key')},${key('poll', 'poll_id')},${key('question', 'question_id')},kind,regexp_replace(path,'^.*/',''),caption,mime,sha256 from berezka.assets`,
  ],
  [
    'profiles',
    'batch_id,user_id,display_name,ownership,job',
    `select ${batch},a.user_id,n.name,f.record->>'ownership',f.record->>'job' from berezka.accounts a
     join berezka.names n on n.id=a.legacy_id join berezka.source u on u.kind='users' and u.id=a.legacy_id
     join berezka.source f on f.kind='users_additional_fields' and f.id=(u.record->>'additional_id')::int`,
  ],
];

// These optional views retain original text, ratings and attribution without copying the
// meetings or ballots into a second set of tables. The product schema has no import dependency.
export async function prepareImport(db) {
  const {
    rows: [state],
  } = await db.query(
    "select to_regclass('berezka.import') checkpoint, to_regclass('historical_imports') evidence"
  );

  if (!state.checkpoint) {
    await db.query(
      await readFile(new URL('./staging.sql', import.meta.url), 'utf8')
    );
  }

  if (state.evidence) {
    return;
  }

  for (const [table, columns, source] of records) {
    let names = columns;
    let query = source;

    if (table === 'polls') {
      names += ',native_poll_id';
      query =
        'select s.*,p.id from (' +
        source +
        ') s(' +
        columns +
        ') left join polls p on p.id=substr(s.id,6)';
    }

    if (table === 'questions') {
      names += ',native_report_id';
      query =
        'select s.*,r.id from (' +
        source +
        ') s(' +
        columns +
        ') left join reports r on r.id=substr(s.id,6)';
    }

    await db.query(
      'create view historical_' + table + '(' + names + ') as ' + query
    );
  }

  await db.query(
    'create view historical_blobs as select sha256,bytes from berezka.blobs'
  );
  await db.query(
    await readFile(new URL('./evidence-access.sql', import.meta.url), 'utf8')
  );
}
