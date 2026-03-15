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
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name != '_prisma_migrations'
       ORDER BY table_name`
    );

    const tables = rows.map((r) => r.table_name);

    if (tables.length === 0) {
      console.log('No tables found. Nothing to do.');

      return;
    }

    const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);

    console.log('\n');
    console.log(
      '  ╔══════════════════════════════════════════════════════════╗'
    );
    console.log(
      '  ║                                                          ║'
    );
    console.log(
      '  ║   ⚠️  WARNING: THIS WILL DELETE ALL DATA IN THE DATABASE  ║'
    );
    console.log(
      '  ║                                                          ║'
    );
    console.log(
      '  ╚══════════════════════════════════════════════════════════╝'
    );
    console.log('\n');
    console.log(`  Database: ${dbName}`);
    console.log(`  Tables to truncate (${tables.length}):\n`);
    tables.forEach((t) => console.log(`    - ${t}`));
    console.log('\n');

    const answer1 = await ask('  Type YES to continue: ');

    if (answer1 !== 'YES') {
      console.log('\n  Aborted.');

      return;
    }

    console.log('\n');
    console.log(
      '  ╔══════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '  ║                                                                  ║'
    );
    console.log(
      '  ║   🚨 ARE YOU ABSOLUTELY SURE?                                    ║'
    );
    console.log(
      '  ║                                                                  ║'
    );
    console.log(
      '  ║   ALL DATA WILL BE PERMANENTLY DELETED.                          ║'
    );
    console.log(
      '  ║   THIS ACTION CANNOT BE UNDONE.                                  ║'
    );
    console.log(
      '  ║   THERE IS NO GOING BACK.                                        ║'
    );
    console.log(
      '  ║                                                                  ║'
    );
    console.log(
      '  ╚══════════════════════════════════════════════════════════════════╝'
    );
    console.log('\n');

    const answer2 = await ask('  Type DELETE EVERYTHING to confirm: ');

    if (answer2 !== 'DELETE EVERYTHING') {
      console.log('\n  Aborted.');

      return;
    }

    const quoted = tables.map((t) => `"${t}"`).join(', ');

    await client.query(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);

    console.log(`\n  ✅ All ${tables.length} tables truncated successfully.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
