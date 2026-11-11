/** Disposable PostgreSQL harness. Requires an explicit test URL; migrates only
 * a newly created random schema and drops only that schema on cleanup. */
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

export async function pollDatabase() {
  const connectionString = process.env.POLL_TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'POLL_TEST_DATABASE_URL is required; DATABASE_URL is never used'
    );
  }

  const url = new URL(connectionString);

  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.endsWith('_test')
  ) {
    throw new Error(
      'POLL_TEST_DATABASE_URL must name a localhost database ending in _test'
    );
  }

  const schema = `poll_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString, max: 2 });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString,
    options: `-c search_path=${schema}`,
    application_name: schema,
    max: 6,
  });

  try {
    const folders = (
      await readdir('prisma/migrations', { withFileTypes: true })
    )
      .filter((f) => f.isDirectory())
      .map((f) => f.name)
      .sort();

    for (const folder of folders) {
      await pool.query(
        await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')
      );
    }
  } catch (error) {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });

  return {
    prisma,
    pool,
    async waitForBlockedWriters(count: number) {
      const deadline = Date.now() + 4000;

      while (Date.now() < deadline) {
        const result = await admin.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
          [schema]
        );

        if (result.rows[0].count >= count) {
          return;
        }
      }

      throw new Error(
        `Expected ${count} blocked writers; database lock barrier was not reached`
      );
    },
    async close() {
      await prisma.$disconnect();
      await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    },
  };
}
