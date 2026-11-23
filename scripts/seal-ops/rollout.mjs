// Database-wide cutover controls. A committed hold survives migration failures,
// application restarts and mixed writer versions. Commands print aggregate data only.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const [command, confirmation] = process.argv.slice(2);
const sql = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const tables = ['polls', 'votes', 'poll_participants'];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const trigger = '"00_seal_rollout_hold"';

async function cutover() {
  await db.query("SET LOCAL lock_timeout='15s'");
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtext('resolutio.poll-seal-rollout-v1'))"
  );
  await db.query(`CREATE SCHEMA IF NOT EXISTS resolutio_ops;
    REVOKE ALL ON SCHEMA resolutio_ops FROM PUBLIC;
    CREATE TABLE IF NOT EXISTS resolutio_ops.poll_seal_rollout (
      version integer primary key, released boolean not null);
    INSERT INTO resolutio_ops.poll_seal_rollout VALUES (1,false) ON CONFLICT DO NOTHING`);
  const {
    rows: [{ released }],
  } = await db.query(
    'SELECT released FROM resolutio_ops.poll_seal_rollout WHERE version=1'
  );

  if (released && command !== 'freeze') {
    return { writes: 'released' };
  }

  // Acquire in ballot writer order. Existing writes must finish before the hold commits.
  await db.query(
    'LOCK TABLE public.polls, public.votes, public.poll_participants IN SHARE ROW EXCLUSIVE MODE'
  );

  if (command === 'release') {
    if (confirmation !== '--all-writers-updated') {
      return {
        error: 'Confirm every writer has been upgraded before releasing',
      };
    }

    const {
      rows: [{ held }],
    } = await db.query(`SELECT count(*)::int AS held FROM pg_trigger WHERE
      tgname='00_seal_rollout_hold' AND tgenabled IN ('O','A') AND
      tgfoid='resolutio_ops.hold_poll_writes()'::regprocedure AND
      tgrelid IN ('public.polls'::regclass,'public.votes'::regclass,'public.poll_participants'::regclass)`);
    const {
      rows: [{ missing }],
    } = await db.query(sql('coverage.sql'));
    await db.query(sql('status.sql'));
    await db.query('SELECT 1 FROM public.seal_bundle_deliveries LIMIT 0');

    if (held !== tables.length || missing !== 0) {
      return { error: 'Incomplete writer hold or ballot coverage' };
    }

    for (const table of tables) {
      await db.query(`DROP TRIGGER ${trigger} ON public.${table}`);
    }

    await db.query(
      'UPDATE resolutio_ops.poll_seal_rollout SET released=true WHERE version=1'
    );

    return { writes: 'released' };
  }

  await db.query(sql('hold.sql'));

  for (const table of tables) {
    await db.query(`CREATE OR REPLACE TRIGGER ${trigger} BEFORE INSERT OR UPDATE OR DELETE
      ON public.${table} FOR EACH ROW EXECUTE FUNCTION resolutio_ops.hold_poll_writes()`);
    await db.query(
      `ALTER TABLE public.${table} ENABLE ALWAYS TRIGGER ${trigger}`
    );
  }

  await db.query(
    'UPDATE resolutio_ops.poll_seal_rollout SET released=false WHERE version=1'
  );

  return { writes: 'held' };
}

async function run() {
  if (!process.env.DATABASE_URL) {
    return { error: 'Missing database configuration' };
  }

  await db.connect();

  if (['prepare', 'freeze', 'release'].includes(command)) {
    await db.query('BEGIN');
    const state = await cutover();
    await db.query(state.error ? 'ROLLBACK' : 'COMMIT');

    return state;
  } else if (command === 'check-runtime') {
    const {
      rows: [{ safe }],
    } = await db.query(`SELECT NOT EXISTS (
      SELECT FROM pg_class c CROSS JOIN pg_roles r WHERE r.rolname=current_user
        AND c.oid IN ('public.votes'::regclass,'public.poll_seals'::regclass)
        AND (r.rolsuper OR r.rolcreaterole OR pg_has_role(current_user,c.relowner,'MEMBER')
          OR has_table_privilege(c.oid,'UPDATE,DELETE,TRUNCATE,TRIGGER')
          OR has_any_column_privilege(c.oid,'UPDATE')
          OR NOT has_table_privilege(c.oid,'INSERT') OR NOT has_table_privilege(c.oid,'SELECT'))
    ) AS safe`);

    return safe
      ? { runtimePrivileges: 'checked' }
      : { error: 'Runtime role requires restricted immutable-table grants' };
  } else if (command === 'coverage') {
    const {
      rows: [counts],
    } = await db.query(sql('coverage.sql'));

    return counts;
  } else if (command === 'status') {
    const {
      rows: [work],
    } = await db.query(sql('status.sql'));
    const { rows: deliveries } =
      await db.query(`SELECT status,count(*) AS count,
      count(*) FILTER (WHERE status='SENDING' AND attempt_started_at <= now()-interval '10 minutes') AS expired
      FROM public.seal_bundle_deliveries GROUP BY status ORDER BY status`);

    return { work, deliveries };
  } else {
    return {
      error: 'Use prepare, freeze, release, check-runtime, coverage or status',
    };
  }
}

try {
  const result = await run();

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result));

    if (result.missing) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  // Do not log driver details, SQL parameters or connection strings.
  console.error('Rollout command failed', error.code ?? 'unexpected');
  process.exitCode = 1;
} finally {
  // Disconnect rolls back any incomplete transaction, including failed release.
  await db.end();
}
