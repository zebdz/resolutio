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
  confirmed_at: Date | null;
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
      `SELECT id, first_name, last_name, middle_name, phone_number, nickname, confirmed_at
       FROM users
       WHERE phone_number ILIKE $1
          OR first_name ILIKE $1
          OR last_name ILIKE $1
          OR middle_name ILIKE $1
          OR nickname ILIKE $1
       ORDER BY last_name, first_name
       LIMIT 20`,
      [pattern]
    );

    if (users.length === 0) {
      console.log('\n  No users found.');

      return;
    }

    console.log('\n  Found users:\n');
    users.forEach((u, i) => {
      const name = [u.last_name, u.first_name, u.middle_name]
        .filter(Boolean)
        .join(' ');
      const status = u.confirmed_at ? '✅' : '⬜';

      console.log(
        `    [${i + 1}] ${status} ${name}  @${u.nickname}  ${u.phone_number}`
      );
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

    if (user.confirmed_at) {
      console.log(
        `\n  "${name}" is already confirmed (${user.confirmed_at.toISOString()}).`
      );

      return;
    }

    const confirm = await ask(
      `\n  Confirm "${name}" (@${user.nickname})? (y/N): `
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log('\n  Aborted.');

      return;
    }

    await client.query(`UPDATE users SET confirmed_at = NOW() WHERE id = $1`, [
      user.id,
    ]);

    console.log(`\n  ✅ User "${name}" (@${user.nickname}) confirmed.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
