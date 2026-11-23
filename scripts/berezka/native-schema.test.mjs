/** Fresh application installations have native polls and need no importer schema. */
import { readdir, readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('keeps the Berezka staging schema and shadow ballot tables out of application migrations', async () => {
  const migrations = await readdir('prisma/migrations', {
    withFileTypes: true,
  });

  for (const folder of migrations.filter((entry) => entry.isDirectory())) {
    const sql = await readFile(
      'prisma/migrations/' + folder.name + '/migration.sql',
      'utf8'
    );
    expect(sql, folder.name).not.toMatch(
      /create\s+(?:schema\s+berezka\b|table\s+historical_)|imported_address_line/i
    );
  }
});
