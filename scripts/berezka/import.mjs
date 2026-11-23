/** Operator entry point for the pinned Berezka migration. Findings stay in a private local file. */
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { planMeetings } from './meeting-import.mjs';
import { apply } from './apply.mjs';
import { verify } from './verify.mjs';
import { preflight, readPackage } from './preflight.mjs';

async function main() {
  process.umask(0o077);
  const {
    positionals: [mode],
    values: args,
  } = parseArgs({
    allowPositionals: true,
    options: {
      package: { type: 'string' },
      findings: { type: 'string' },
      overrides: { type: 'string' },
      'mapping-digest': { type: 'string' },
      attestation: { type: 'string' },
    },
  });

  if (
    !['dry-run', 'apply', 'verify'].includes(mode) ||
    !args.package ||
    !process.env.DATABASE_URL
  ) {
    return 'Expected dry-run, apply or verify with --package and DATABASE_URL';
  }

  if (mode === 'dry-run' && !args.findings) {
    return 'Provide --findings NEW_FILE';
  }

  if (
    mode === 'apply' &&
    (!/^[a-f0-9]{64}$/.test(args['mapping-digest'] ?? '') ||
      !args.attestation?.trim())
  ) {
    return 'Provide --mapping-digest and --attestation';
  }

  const pkg = await readPackage(args.package);

  if (pkg.error) {
    return pkg.error;
  }

  const overrides = args.overrides
    ? JSON.parse(await readFile(args.overrides, 'utf8'))
    : {};
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    await db.query("set time zone 'UTC'");

    if (mode === 'apply') {
      const result = await apply(db, pkg.data, args.package, {
        overrides,
        mappingDigest: args['mapping-digest'],
        attestation: args.attestation,
      });

      if (result.error) {
        return result.error;
      }

      console.log(JSON.stringify(result));

      return;
    }

    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    if (mode === 'verify') {
      const result = await verify(db, pkg.data);
      await db.query('ROLLBACK');

      if (result.error) {
        return result.error;
      }

      console.log(JSON.stringify(result));

      return;
    }

    const result = await preflight(db, pkg.data, overrides);
    await db.query('ROLLBACK');

    if (result.error) {
      return result.error;
    }

    const mapping = planMeetings(pkg.data, result.asOf);

    if (mapping.error) {
      return mapping.error;
    }

    await writeFile(
      args.findings,
      JSON.stringify(
        {
          ...result,
          nativeMeetingPreview: mapping.meetings,
          overrides: Object.fromEntries(
            result.decisions
              .filter((d) => d.action === 'review')
              .map((d) => [d.legacyId, null])
          ),
        },
        null,
        2
      ) + '\n',
      { flag: 'wx', mode: 0o600 }
    );
    await writeFile(
      args.findings + '.overrides.json',
      JSON.stringify(
        {
          ...Object.fromEntries(
            result.decisions
              .filter((d) => d.action === 'review')
              .map((d) => [d.legacyId, null])
          ),
          ...overrides,
        },
        null,
        2
      ) + '\n',
      { flag: 'wx', mode: 0o600 }
    );
    console.log(
      JSON.stringify({
        counts: result.counts,
        organizationCollision: result.collision,
        mappingDigest: result.mappingDigest,
      })
    );

    if (result.collision || result.counts.review) {
      return 'Review required';
    }
  } finally {
    await db.end();
  }
}

main()
  .then((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    // PostgreSQL details may contain private row values.
    console.error(
      'Import operation failed',
      error.code ?? error.name,
      error.table ?? '',
      error.column ?? '',
      error.constraint ?? ''
    );
    process.exitCode = 1;
  });
