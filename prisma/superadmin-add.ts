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

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone_number: string;
  nickname: string;
}

async function main() {
  const client = await pool.connect();

  try {
    const search = await ask('  Search user (phone / name / nickname): ');

    if (!search) {
      console.log('\n  Aborted.');

      return;
    }

    const pattern = `%${search}%`;

    const { rows: users } = await client.query<UserRow>(
      `SELECT u.id, u.first_name, u.last_name, u.middle_name, u.phone_number, u.nickname
       FROM users u
       LEFT JOIN superadmins s ON s.user_id = u.id
       WHERE s.user_id IS NULL
         AND (u.phone_number ILIKE $1
              OR u.first_name ILIKE $1
              OR u.last_name ILIKE $1
              OR u.middle_name ILIKE $1
              OR u.nickname ILIKE $1)
       ORDER BY u.last_name, u.first_name
       LIMIT 20`,
      [pattern]
    );

    if (users.length === 0) {
      console.log('\n  No users found (or already superadmins).');

      return;
    }

    console.log('\n  Found users:\n');
    users.forEach((u, i) => {
      const name = [u.last_name, u.first_name, u.middle_name]
        .filter(Boolean)
        .join(' ');

      console.log(`    [${i + 1}] ${name}  @${u.nickname}  ${u.phone_number}`);
    });

    const pick = await ask('\n  Pick a number (or empty to cancel): ');
    const idx = parseInt(pick, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= users.length) {
      console.log('\n  Aborted.');

      return;
    }

    const user = users[idx];
    const name = [user.last_name, user.first_name, user.middle_name]
      .filter(Boolean)
      .join(' ');

    const confirm = await ask(
      `\n  Make "${name}" (@${user.nickname}) a superadmin? (y/N): `
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log('\n  Aborted.');

      return;
    }

    await client.query(
      `INSERT INTO superadmins (user_id, created_at) VALUES ($1, NOW())`,
      [user.id]
    );

    const { rows } = await client.query(
      `SELECT s.user_id, s.created_at, u.first_name, u.last_name, u.nickname
       FROM superadmins s JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [user.id]
    );

    console.log('\n  ✅ Superadmin created:\n');
    console.log(`    user_id:    ${rows[0].user_id}`);
    console.log(`    name:       ${rows[0].last_name} ${rows[0].first_name}`);
    console.log(`    nickname:   @${rows[0].nickname}`);
    console.log(`    created_at: ${rows[0].created_at}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
