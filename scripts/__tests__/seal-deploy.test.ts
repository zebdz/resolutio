/** Exercise packaging and deployment in tiny release trees. A deployment must
 * retain startup/config files and compiled operators without changing local secrets. */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
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

it('makes browser assets readable through nginx and keeps server files private', () => {
  const root = mkdtempSync(join(tmpdir(), 'seal-deploy-'));
  const build = join(root, 'build');
  const site = join(root, 'site');
  const archive = join(root, 'release.tar.gz');

  try {
    mkdirSync(site);
    copyFileSync(
      resolve('deploy-on-server.sh'),
      join(site, 'deploy-on-server.sh')
    );

    for (const file of [
      '.next/static/chunks/app.css',
      '.next/server/app.js',
      'public/images/logo.svg',
      'scripts/seal-ops/rollout.mjs',
      'node_modules/fixture/index.js',
    ]) {
      mkdirSync(dirname(join(build, file)), { recursive: true });
      writeFileSync(join(build, file), '');
    }

    writeFileSync(join(build, '.env'), 'PORT=3000\n');
    // Stop at the migration boundary, before any process or database operations.
    writeFileSync(
      join(build, 'migrate-production.sh'),
      '#!/bin/sh\nexit 42\n',
      { mode: 0o755 }
    );
    execFileSync('tar', [
      '-czf',
      archive,
      '-C',
      build,
      '.next',
      'public',
      'scripts',
      'node_modules',
      '.env',
      'migrate-production.sh',
    ]);
    const deploy = spawnSync('bash', ['deploy-on-server.sh', archive], {
      cwd: site,
      input: 'fixture\n',
      encoding: 'utf8',
    });
    expect(deploy.status, deploy.stderr).toBe(42);
    const mode = (path: string) => statSync(join(site, path)).mode;

    for (const dir of [
      '.next',
      '.next/static',
      '.next/static/chunks',
      'public',
      'public/images',
    ]) {
      expect(mode(dir) & 0o001, dir).toBe(0o001);
    }

    for (const file of [
      '.next/static/chunks/app.css',
      'public/images/logo.svg',
    ]) {
      expect(mode(file) & 0o004, file).toBe(0o004);
    }

    for (const path of ['.env', '.next/server', '.next/server/app.js']) {
      expect(mode(path) & 0o077, path).toBe(0);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
