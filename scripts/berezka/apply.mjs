/** Stage private blobs in independently committed batches. Recheck identities under write locks
 * and publish all native accounts, governance and verified historical records in one transaction. */
import { publishNative, restoreQuestionOwners } from './native-import.mjs';
import { prepareImport } from './project.mjs';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { orgId, packageDigest, preflight } from './preflight.mjs';
import { assetKey, questionContent } from './content.mjs';
import { verify, restrictedRow } from './verify.mjs';

const mimeTypes = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const nativeId = (id) => 'berezka-user-' + id;
const asUtc = (value) => (value ? value.replace(' ', 'T') + 'Z' : null);

async function beginMatching(db, data, opts) {
  await db.query('begin');
  await db.query('lock table users, organizations in share row exclusive mode');
  const match = await preflight(db, data, opts.overrides);

  if (
    match.error ||
    match.collision ||
    match.counts.review ||
    (!match.imported && match.mappingDigest !== opts.mappingDigest)
  ) {
    await db.query('rollback');

    return {
      error:
        match.error ??
        'Destination identity or organization drift; run preflight again',
    };
  }

  return match;
}

export function parseLegacyAddress(line) {
  const normalized = line
    .trim()
    .replace(/^.+?,\s*ул\.?\s+/iu, '')
    .replace(/,\s*(?=\d)/u, ' ');
  const match = normalized.match(/^([\p{L}][\p{L}. -]*?)(?:\s+(\d.*))?$/u);

  return { street: match?.[1]?.trim() ?? null, building: match?.[2] ?? null };
}

async function importAddress(db, id, u) {
  const { street, building } = parseLegacyAddress(u.address);
  await db.query(
    `insert into addresses(id,user_id,country,city,street,building,is_private_house,one_line,updated_at)
       values($1,$2,'Россия','Ростов-на-Дону',$3,$4,null,$5,now()) on conflict(user_id) do nothing`,
    ['berezka-address-' + u.id, id, street, building, u.address]
  );
}

async function importContent(db, rows, assets) {
  const contents = rows.questions.map((q) => ({
    question_id: q.id,
    ...questionContent(q, rows, assets),
  }));
  await db.query(
    `insert into berezka.content select * from jsonb_to_recordset($1) as x(question_id int,title text,body text,issues jsonb)
      on conflict(question_id) do update set title=excluded.title,body=excluded.body,issues=excluded.issues`,
    [JSON.stringify(contents)]
  );
}

async function publish(db, data, match) {
  const { rows, assets } = data;
  const users = new Map(rows.users.map((u) => [u.id, u]));
  const resolved = new Map();

  for (const d of match.decisions) {
    const id = d.targetId ?? nativeId(d.legacyId);
    const u = users.get(d.legacyId);

    if (d.action === 'create') {
      const [last, first, middle] = u.name.split('(')[0].trim().split(/\s+/);
      await db.query(
        `insert into users(id,first_name,last_name,middle_name,phone_number,password,nickname,email,
        language,created_at,confirmed_at,allow_find_by_name,allow_find_by_phone,allow_find_by_address,
        privacy_setup_completed)
        values($1,$2,$3,$4,$5,$6,$7,$8,'ru',$9,case when $10 then now() end,true,true,true,true)`,
        [
          id,
          first,
          last,
          middle ?? null,
          '+7' + u.phone,
          'bcrypt:' + u.password,
          d.nickname,
          u.email?.trim().toLowerCase() || null,
          asUtc(u.created_at),
          u.id !== 117,
        ]
      );
    }

    if (d.action === 'reuse' && d.addSourceEmail) {
      await db.query(
        'update users set email=$1,email_confirmed_at=null where id=$2 and email is null',
        [u.email.trim().toLowerCase(), id]
      );
    }

    await importAddress(db, id, u);
    await db.query(
      'insert into berezka.accounts(legacy_id,user_id,created) values($1,$2,$3)',
      [u.id, id, d.action === 'create']
    );
    resolved.set(u.id, id);
  }

  const company = rows.companies[0];
  await db.query(
    'insert into organizations(id,name,description,created_by_id,created_at) values($1,$2,$3,$4,coalesce($5::timestamptz,now()))',
    [
      orgId,
      company.title,
      company.description ?? '',
      resolved.get(1),
      asUtc(company.created_at),
    ]
  );
  await db.query(
    "insert into organization_users(id,organization_id,user_id,status,voting_eligible) select 'berezka-member-'||legacy_id,$1,user_id,'accepted',legacy_id=any($2::int[]) from berezka.accounts",
    [
      orgId,
      rows.users
        .filter((u) => u.permissions.split(',').includes('voter'))
        .map((u) => u.id),
    ]
  );
  await db.query(
    'insert into organization_admin_users(organization_id,user_id) select $1,user_id from berezka.accounts where legacy_id=any($2::int[])',
    [orgId, [1, 155, 283]]
  );
  await db.query(
    "insert into boards(id,name,organization_id) values('berezka-board','Правление КП Березка',$1)",
    [orgId]
  );
  await db.query(
    "insert into board_users(id,board_id,user_id) select 'berezka-board-'||legacy_id,'berezka-board',user_id from berezka.accounts where legacy_id=any($1::int[])",
    [[5, 221, 255]]
  );

  for (const [kind, records] of Object.entries(rows)) {
    await db.query(
      `insert into berezka.source(kind,id,record) select $1,(record->>'id')::int,record from jsonb_array_elements($2::jsonb) record`,
      [kind, JSON.stringify(records.map((r) => restrictedRow(kind, r)))]
    );
  }

  await importContent(db, rows, assets);
  const captions = new Map(
    rows.question_files.map((f) => [f.id, f.text_for_file])
  );
  const metadata = assets.map((a) => ({
    key: assetKey(a),
    poll_id: a.poll,
    question_id: a.question ?? null,
    kind: a.kind,
    path: a.path,
    caption: captions.get(a.file) ?? null,
    mime:
      a.mime ??
      mimeTypes[extname(a.path).toLowerCase()] ??
      'application/octet-stream',
    sha256: a.sha256,
  }));
  await db.query(
    `insert into berezka.assets select * from jsonb_to_recordset($1) as x(key text,poll_id int,question_id int,kind text,path text,caption text,mime text,sha256 text)`,
    [JSON.stringify(metadata)]
  );
}

async function finishNativeImport(
  db,
  data,
  publishing,
  existingNative = false
) {
  const native = existingNative
    ? await restoreQuestionOwners(db, data)
    : await publishNative(db, data);

  if (native.error) {
    await db.query('rollback');

    return native;
  }

  await db.query(
    'update berezka.import set published_at=coalesce(published_at,now()),history_version=4'
  );
  const checked = await verify(db, data, { publishing });
  await db.query(checked.error ? 'rollback' : 'commit');

  return checked;
}

export async function apply(db, data, dir, opts) {
  const lock = await db.query(
    "select pg_try_advisory_lock(hashtextextended('decision.community/berezka',0)) acquired"
  );

  if (!lock.rows[0].acquired) {
    return { error: 'Another Berezka import holds the organization lock' };
  }

  // Connection close releases the session-level lock even after an interruption.
  const match = await beginMatching(db, data, opts);

  if (match.error) {
    return match;
  }

  await prepareImport(db);
  const existing = (await db.query('select * from berezka.import')).rows[0];

  if (
    existing &&
    (existing.digest !== packageDigest ||
      (existing.mapping_digest !== opts.mappingDigest &&
        (!match.imported || match.mappingDigest !== opts.mappingDigest)))
  ) {
    await db.query('rollback');

    return { error: 'Checkpoint digest mismatch' };
  }

  if (match.imported) {
    if (existing.history_version === 1) {
      const users = new Map(data.rows.users.map((u) => [u.id, u]));

      for (const decision of existing.identity_plan.filter(
        (d) => d.action === 'reuse'
      )) {
        await importAddress(
          db,
          decision.targetId,
          users.get(decision.legacyId)
        );
      }

      await importContent(db, data.rows, data.assets);
    }

    if (existing.history_version < 4) {
      return finishNativeImport(
        db,
        data,
        false,
        existing.history_version === 3
      );
    }

    const checked = await verify(db, data);
    await db.query('rollback');

    return { ...checked, changed: 0 };
  }

  if (!existing) {
    await db.query(
      'insert into berezka.import(digest,mapping_digest,attestation,identity_plan) values($1,$2,$3,$4)',
      [
        packageDigest,
        opts.mappingDigest,
        opts.attestation,
        JSON.stringify(match.decisions),
      ]
    );
  }

  await db.query('commit');
  const staged = new Set(
    (await db.query('select sha256 from berezka.blobs')).rows.map(
      (b) => b.sha256
    )
  );
  const missing = [...new Set(data.assets.map((a) => a.sha256))].filter(
    (d) => !staged.has(d)
  );

  for (let start = 0; start < missing.length; start += 20) {
    await db.query('begin');

    for (const digest of missing.slice(start, start + 20)) {
      const bytes = await readFile(join(dir, 'blobs', digest));
      await db.query('insert into berezka.blobs(sha256,bytes) values($1,$2)', [
        digest,
        bytes,
      ]);
    }

    await db.query('commit');
  }

  const fresh = await beginMatching(db, data, opts);

  if (fresh.error) {
    return fresh;
  }

  await publish(db, data, fresh);

  return finishNativeImport(db, data, true);
}
