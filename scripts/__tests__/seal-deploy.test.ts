/** Isolate the release packager in a tiny fake build tree. A deployment must
 * retain startup/config files and compiled operators without changing local secrets. */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('ships runtime config and operator entry points and preserves the development env', () => {
  const root = mkdtempSync(join(tmpdir(), 'seal-package-'));
  const files = [
    '.next/BUILD_ID',
    '.next/dev/private',
    '.next/cache/private',
    'node_modules/pg/index.js',
    'generated/prisma/client.js',
    'prisma/schema.prisma',
    'public/favicon.ico',
    'messages/en.json',
    'src/infrastructure/anchor/ots-worker.mjs',
    'src/i18n/request.ts',
    'build/version-helper.ts',
    'build/verify-seal.mjs',
    'build/backfill-receipt-secrets.cjs',
    'scripts/seal-ops/worker.mjs',
    'scripts/seal-ops/rollout.mjs',
    ...[
      'import',
      'preflight',
      'matching',
      'apply',
      'project',
      'meeting-import',
      'meeting-evidence',
      'native-import',
      'verify',
      'verify-access',
      'content',
    ].map((module) => `scripts/berezka/${module}.mjs`),
    'scripts/berezka/staging.sql',
    'scripts/berezka/evidence-access.sql',
    '.berezka-private/package/manifest.json',
    'package.json',
    'next.config.ts',
    'prisma.config.ts',
    'migrate-production.sh',
    'deploy-on-server.sh',
    'start-production.sh',
  ];

  try {
    for (const file of files) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), 'fixture');
    }

    writeFileSync(join(root, '.env'), 'local-only');
    writeFileSync(join(root, 'runtime.env'), 'runtime-only');
    execFileSync(resolve('create-deploy-package.sh'), ['runtime.env'], {
      cwd: root,
    });
    const members = execFileSync('tar', ['-tzf', 'deploy.tar.gz'], {
      cwd: root,
      encoding: 'utf8',
    }).split('\n');
    expect(members).toContain('src/i18n/request.ts');
    expect(members).toContain('build/backfill-receipt-secrets.cjs');
    expect(members).toContain('scripts/seal-ops/worker.mjs');
    expect(members).toContain('scripts/berezka/import.mjs');
    expect(members).toContain('scripts/berezka/native-import.mjs');
    expect(members).toContain('scripts/berezka/staging.sql');
    expect(members).toContain('scripts/berezka/evidence-access.sql');
    expect(members).not.toContain('.berezka-private/package/manifest.json');
    expect(members).not.toContain('.next/dev/private');
    expect(members).not.toContain('.next/cache/private');
    expect(statSync(join(root, 'deploy.tar.gz')).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('local-only');
    expect(
      execFileSync('tar', ['-xOzf', 'deploy.tar.gz', '.env'], {
        cwd: root,
        encoding: 'utf8',
      })
    ).toBe('runtime-only');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
