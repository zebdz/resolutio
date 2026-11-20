/** Run the distributable in an empty directory using only Node and exported files.
 * Same adversarial corpus as the browser-compatible core, with process exit codes asserted. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { evidence, invalidCases } from '@/domain/seal/__tests__/evidenceCases';
import type { EvidenceFiles } from '@/domain/seal/VerifyEvidence';
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'resolutio-verify-'));
  const result = await build({
    entryPoints: ['scripts/verify-seal.ts'],
    outfile: join(dir, 'verify-seal.mjs'),
    platform: 'node',
    format: 'esm',
    target: 'node20',
    bundle: true,
    metafile: true,
  });

  for (const output of Object.values(result.metafile.outputs)) {
    expect(output.imports.every((i) => i.path.startsWith('node:'))).toBe(true);
  }
});
afterAll(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function run(files: EvidenceFiles) {
  const args = ['verify-seal.mjs'];

  for (const [key, bytes] of Object.entries(files)) {
    const file = key + '.input';
    await writeFile(join(dir, file), bytes);
    args.push('--' + (key === 'code' ? 'code-file' : key), file);
  }

  return spawnSync(process.execPath, args, {
    cwd: dir,
    // Next augments ProcessEnv with a required NODE_ENV. The standalone CLI needs none.
    env: {} as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
}

it('runs the original weighted receipt with no app environment', async () => {
  const result = await run(evidence);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    ballot: 'originalReceiptMatches',
    timestamp: 'pending',
  });
});
it.each(invalidCases)('returns failure for %s', async (_, files, error) => {
  const result = await run(files);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('domain.seal.' + error);
});
