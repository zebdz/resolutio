import 'dotenv/config';
import pg from 'pg';
import readline from 'readline';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface OrgRow {
  id: string;
  name: string;
  member_count: number;
}

async function main() {
  const client = await pool.connect();

  try {
    const search = await ask('  Search organization by name: ');

    if (!search) {
      console.log('\n  Aborted.');

      return;
    }

    const pattern = `%${search}%`;

    const { rows: orgs } = await client.query<OrgRow>(
      `SELECT o.id, o.name,
              (SELECT COUNT(*) FROM organization_users ou WHERE ou.organization_id = o.id)::int AS member_count
       FROM organizations o
       WHERE o.name ILIKE $1 AND o.archived_at IS NULL
       ORDER BY o.name
       LIMIT 20`,
      [pattern]
    );

    if (orgs.length === 0) {
      console.log('\n  No organizations found.');

      return;
    }

    console.log('\n  Found organizations:\n');
    orgs.forEach((o, i) => {
      console.log(`    [${i + 1}] ${o.name}  (${o.member_count} members)`);
    });

    const pick = await ask('\n  Pick a number (or empty to cancel): ');
    const idx = parseInt(pick, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= orgs.length) {
      console.log('\n  Aborted.');

      return;
    }

    const org = orgs[idx];

    // Find users who are NOT members and do NOT have pending requests
    const { rows: candidates } = await client.query<{
      id: string;
      first_name: string;
      last_name: string;
      nickname: string;
    }>(
      `SELECT u.id, u.first_name, u.last_name, u.nickname
       FROM users u
       WHERE u.id NOT IN (
         SELECT ou.user_id FROM organization_users ou WHERE ou.organization_id = $1
       )
       AND u.id NOT IN (
         SELECT ou.user_id FROM organization_users ou
         WHERE ou.organization_id = $1 AND ou.status = 'pending'
       )
       ORDER BY random()
       LIMIT 20`,
      [org.id]
    );

    if (candidates.length === 0) {
      console.log('\n  No eligible users found.');

      return;
    }

    const confirm = await ask(
      `\n  Add ${candidates.length} join requests to "${org.name}"? (y/N): `
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log('\n  Aborted.');

      return;
    }

    let added = 0;

    for (const u of candidates) {
      await client.query(
        `INSERT INTO organization_users (id, organization_id, user_id, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'pending', NOW())
         ON CONFLICT DO NOTHING`,
        [org.id, u.id]
      );
      added++;
    }

    console.log(
      `\n  ✅ Added ${added} pending join requests to "${org.name}".\n`
    );
    console.log('  Users added:\n');
    candidates.forEach((u) => {
      const name = [u.last_name, u.first_name].filter(Boolean).join(' ');
      console.log(`    ${name}  @${u.nickname}`);
    });
    console.log('');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
