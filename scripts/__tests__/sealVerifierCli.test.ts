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

  const { attachment, ...documents } = files;

  if (attachment) {
    await writeFile(join(dir, 'attachment.input'), attachment.bytes);
    args.push(
      '--attachment',
      'attachment.input',
      '--attachment-id',
      attachment.id
    );
  }

  for (const [key, bytes] of Object.entries(documents)) {
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

it('verifies a local attachment against its committed question and rejects a same-size substitution', async () => {
  const section = join(dir, 'question-sections.json');
  const file = join(dir, 'appendix.pdf');
  const args = [
    'verify-seal.mjs',
    '--sections',
    section,
    '--attachment-id',
    'file2',
    '--attachment',
    file,
  ];
  await writeFile(section, evidence.sections);
  await writeFile(file, Buffer.alloc(200));
  const ok = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  expect(ok.status).toBe(0);
  expect(JSON.parse(ok.stdout).verifiedAttachment).toMatchObject({
    id: 'file2',
    questionId: 'q2',
  });
  await writeFile(file, Buffer.alloc(200, 1));
  expect(spawnSync(process.execPath, args, { cwd: dir }).status).toBe(1);
});
