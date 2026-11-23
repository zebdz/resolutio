/** Copy the approved file crosswalk into native poll/report attachments in the caller's transaction.
 * The caller supplies native parent identities and must roll back on an error or failed check. */
import { historyKey } from './content.mjs';
import { randomUUID } from 'node:crypto';

export async function attachMeetingEvidence(db, meetings, pollIds, recordedBy) {
  const pollFiles = [];
  const protocolFiles = [];
  let protocolReports = 0;
  const descriptions = [];

  for (const meeting of meetings) {
    const poll = pollIds.get(meeting.sourceId);

    if (!poll) {
      return { error: 'Missing native poll for meeting ' + meeting.sourceId };
    }

    const reference = (key, target) => ({
      id: randomUUID(),
      key,
      source: meeting.sourceId,
      target,
    });
    pollFiles.push(
      ...meeting.questionFiles.map(({ key, question }) => ({
        ...reference(key, poll),
        question: historyKey('question', question).slice(5),
      }))
    );
    const links = [];
    descriptions.push({ poll, links });

    const report = meeting.protocolReport;

    if (!report) {
      continue;
    }

    // The designated recorder publishes the archive report at import time.
    // Attribution and signatures of the historical officers remain in the document.
    const inserted = await db.query(
      `insert into reports(id, organization_id, created_by_id, title, body, visibility, state,
                           published_by_id, last_published_at, created_at, updated_at)
       select gen_random_uuid()::text,p.organization_id,$3,left('Протокол — '||p.title,200),
          'Документы из архива собрания «'||p.title||'».', $2::report_visibility_enum,'PUBLISHED',
          $3,i.imported_at,i.imported_at,i.imported_at
       from polls p cross join berezka.import i
       where p.id=$1 and p.organization_id='berezka-company-1' and p.state='FINISHED'
         and (($2='WITHIN_ORG_ONLY' and p.board_id is null) or ($2='WITHIN_BOARDS' and p.board_id='berezka-board'))
       returning id`,
      [poll, report.visibility, recordedBy]
    );

    if (inserted.rowCount !== 1) {
      return {
        error: 'Native poll audience differs for meeting ' + meeting.sourceId,
      };
    }

    const id = inserted.rows[0].id;
    links.unshift(`[Протокол собрания](/reports/${id})`);
    await db.query(
      'insert into report_polls(report_id,poll_id) values ($1,$2)',
      [id, poll]
    );
    await db.query(
      'insert into report_boards(report_id,board_id) select $1,board_id from polls where id=$2 and board_id is not null',
      [id, poll]
    );
    protocolFiles.push(...report.files.map((key) => reference(key, id)));
    protocolReports++;
  }

  const assets = `from jsonb_to_recordset($1::jsonb) x(id text,key text,source int,target text,question text)
     join berezka.assets a on a.key=x.key and a.poll_id=x.source
     join berezka.blobs b using(sha256) cross join berezka.import i`;
  const metadata = `x.id,x.target,regexp_replace(a.path,'^.*/',''),a.mime,
     octet_length(b.bytes),b.bytes,i.imported_at`;
  const poll = await db.query(
    `insert into poll_attachments(id,poll_id,file_name,mime_type,size_bytes,bytes,created_at,question_id)
     select ${metadata},x.question ${assets} join polls p on p.id=x.target and p.organization_id='berezka-company-1'
     where a.kind in ('question_file','inline')`,
    [JSON.stringify(pollFiles)]
  );
  const report = await db.query(
    `insert into report_attachments(id,report_id,file_name,mime_type,size_bytes,bytes,created_at)
     select ${metadata} ${assets}
     join reports r on r.id=x.target and r.organization_id='berezka-company-1'
     where a.kind in ('protocol','protocol_doc','blank_doc','blank_with_answers_doc')
       and r.visibility in ('WITHIN_BOARDS','WITHIN_ORG_ONLY')`,
    [JSON.stringify(protocolFiles)]
  );

  if (
    poll.rowCount !== pollFiles.length ||
    report.rowCount !== protocolFiles.length
  ) {
    return {
      error: 'Native attachment ownership or content could not be reconciled',
    };
  }

  const updates = descriptions
    .filter((row) => row.links.length)
    .map(({ poll, links }) => ({
      poll,
      suffix: '\n\n' + links.join('\n'),
    }));
  const updated = await db.query(
    `update polls p set description=p.description||x.suffix
     from jsonb_to_recordset($1::jsonb) x(poll text,suffix text)
     where p.id=x.poll and p.organization_id='berezka-company-1' and p.state='FINISHED'
       and char_length(p.description||x.suffix)<=10000`,
    [JSON.stringify(updates)]
  );

  if (updated.rowCount !== updates.length) {
    return {
      error:
        'Meeting evidence links exceed the native poll description or poll is unavailable',
    };
  }

  return {
    polls: meetings.length,
    pollAttachments: poll.rowCount,
    protocolReports,
    protocolAttachments: protocolFiles.length,
  };
}
