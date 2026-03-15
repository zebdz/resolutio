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

async function main() {
  const client = await pool.connect();

  try {
    const { rows: admins } = await client.query(
      `SELECT s.user_id, s.created_at, u.first_name, u.last_name, u.middle_name, u.nickname, u.phone_number
       FROM superadmins s JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at`
    );

    if (admins.length === 0) {
      console.log('\n  No superadmins found.\n');

      return;
    }

    console.log('\n  Current superadmins:\n');
    admins.forEach((a, i) => {
      const name = [a.last_name, a.first_name, a.middle_name]
        .filter(Boolean)
        .join(' ');

      console.log(
        `    [${i + 1}] ${name}  @${a.nickname}  ${a.phone_number}  (since ${a.created_at.toISOString().slice(0, 10)})`
      );
    });

    const pick = await ask(
      '\n  Pick a number to remove (or empty to cancel): '
    );
    const idx = parseInt(pick, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= admins.length) {
      console.log('\n  Aborted.');

      return;
    }

    const admin = admins[idx];
    const name = [admin.last_name, admin.first_name, admin.middle_name]
      .filter(Boolean)
      .join(' ');

    const confirm = await ask(
      `\n  Remove "${name}" (@${admin.nickname}) from superadmins? (y/N): `
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log('\n  Aborted.');

      return;
    }

    await client.query(`DELETE FROM superadmins WHERE user_id = $1`, [
      admin.user_id,
    ]);

    console.log(`\n  ✅ Removed "${name}" from superadmins.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
