/** Read and validate the offline package, then classify every account in one consistent DB snapshot. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { matchAccounts } from './matching.mjs';

export const packageDigest =
  'c912d6821350259d9b51cf28595c18e8c9e457982e2759b95ea1fee91aba38e4';
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const orgId = 'berezka-company-1';

/** The legacy count multiplies the ownership share by each assigned right’s weight. */
export function sourceVotingWeights(rows) {
  const weight = new Map();
  const rights = new Map(rows.rights.map((r) => [r.id, r]));

  for (const assignment of rows.right_user) {
    const r = rights.get(assignment.right_id);

    if (r.type_of_right === 1) {
      weight.set(
        assignment.user_id,
        (weight.get(assignment.user_id) ?? 0) + r.weight * r.number_of_share
      );
    }
  }

  return weight;
}

export function checkEqualDistribution(rows) {
  const weights = sourceVotingWeights(rows);

  if (rows.votes.some((vote) => weights.get(vote.user_id) !== 1)) {
    return {
      error: 'Recorded voter has a missing or non-unit ownership weight',
    };
  }

  return { distributionType: 'EQUAL' };
}

export async function readPackage(dir) {
  const raw = await readFile(join(dir, 'manifest.json'));

  if (sha(raw) !== packageDigest) {
    return { error: 'Unapproved package digest' };
  }

  const data = JSON.parse(raw);
  const distribution = checkEqualDistribution(data.rows);

  if (distribution.error) {
    return distribution;
  }

  for (const asset of data.assets) {
    const body = await readFile(join(dir, 'blobs', asset.sha256));

    if (body.length !== asset.size || sha(body) !== asset.sha256) {
      return { error: 'Asset digest mismatch' };
    }
  }

  return { data };
}

export async function preflight(db, data, overrides) {
  const users = data.rows.users;

  if (
    !overrides ||
    Array.isArray(overrides) ||
    typeof overrides !== 'object' ||
    Object.values(overrides).some(
      (v) =>
        v !== null &&
        (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(v))
    )
  ) {
    return { error: 'Invalid overrides object' };
  }

  if (
    Object.keys(overrides).some((k) => !users.some((u) => String(u.id) === k))
  ) {
    return { error: 'Unknown override key' };
  }

  const accounts = await db.query(
    `select id, nickname, phone_number, concat_ws(' ',last_name,first_name,middle_name) full_name, confirmed_at,email from users order by id`
  );
  const orgs = await db.query(
    'select id from organizations where lower(trim(name))=lower(trim($1)) or id=$2',
    [data.rows.companies[0].title, orgId]
  );
  const schema = await db.query(
    "select to_regclass('berezka.accounts') as accounts, transaction_timestamp() as as_of"
  );
  let asOf = schema.rows[0].as_of;
  let persisted = {};
  let imported = false;
  const invalidMappings = new Set();

  if (schema.rows[0].accounts) {
    const mappings = await db.query(
      'select legacy_id,user_id,created from berezka.accounts order by legacy_id'
    );
    persisted = Object.fromEntries(
      mappings.rows.map((r) => [r.legacy_id, r.user_id])
    );
    const run = await db.query(
      'select imported_at,published_at,identity_plan from berezka.import where digest=$1',
      [packageDigest]
    );
    asOf = run.rows[0]?.imported_at ?? asOf;
    imported = Boolean(run.rows[0]?.published_at);

    if (imported) {
      const approved = new Map(
        run.rows[0].identity_plan.map((d) => [d.legacyId, d])
      );
      const actual = new Map(mappings.rows.map((m) => [m.legacy_id, m]));

      for (const u of users) {
        const a = approved.get(u.id),
          m = actual.get(u.id);

        if (
          !m ||
          !a ||
          m.created !== (a.action === 'create') ||
          m.user_id !== (a.targetId ?? 'berezka-user-' + u.id)
        ) {
          invalidMappings.add(u.id);
        }
      }
    } else if (mappings.rows.length) {
      for (const m of mappings.rows) {
        invalidMappings.add(m.legacy_id);
      }
    }
  }

  const collision = orgs.rows.some((org) => org.id !== orgId || !imported);
  const decisions = matchAccounts(users, accounts.rows, persisted, overrides);

  for (const d of decisions) {
    if (invalidMappings.has(d.legacyId)) {
      d.action = 'review';
      d.reason =
        'Stored crosswalk disagrees with original approved identity plan';
      d.targetId = null;
    }
  }

  const counts = Object.fromEntries(
    ['create', 'reuse', 'review'].map((action) => [
      action,
      decisions.filter((d) => d.action === action).length,
    ])
  );
  const mappingDigest = sha(JSON.stringify({ decisions, collision }));
  const exceptions = {
    placeholder: 117,
    parentheticalNames: users
      .filter((u) => u.name.includes('('))
      .map((u) => u.id),
    partialAddresses: users.filter((u) => u.address?.trim()).map((u) => u.id),
    additionalProfiles: data.rows.users_additional_fields.length,
    nonvoters: users
      .filter((u) => !u.permissions.split(',').includes('voter'))
      .map((u) => u.id),
    admins: users
      .filter((u) => u.permissions.split(',').includes('admin'))
      .map((u) => u.id),
    board: users
      .filter((u) => u.permissions.split(',').includes('governance'))
      .map((u) => u.id),
    unresolvedOfficers: data.rows.organizers.flatMap((o) =>
      ['user_chairman_id', 'user_secretary_id', 'user_counter_votes_id']
        .filter((k) => !users.some((u) => u.id === o[k]))
        .map((k) => ({ organizer: o.id, role: k, sourceId: o[k] }))
    ),
    missingOrganizerPolls: data.rows.organizers
      .filter((o) => !data.rows.polls.some((p) => p.id === o.poll_id))
      .map((o) => o.poll_id),
  };

  return {
    asOf,
    counts,
    collision,
    imported,
    mappingDigest,
    decisions,
    exceptions,
    packageDigest,
  };
}
