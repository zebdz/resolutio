/** Build and execute the pure core without Node globals or builtin modules.
 * This smoke check covers shared algorithms, strict decoders and record construction. */
import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import fixture from './fixtures/record-v1.json';

it('reproduces the golden record and receipt in a browser-targeted bundle', async () => {
  const result = await build({
    stdin: {
      contents: `
      import { SealedRecordBuilder } from './src/domain/seal/SealedRecordBuilder';
      import { VoteReceipt } from './src/domain/seal/VoteReceipt';
      import fixture from './src/domain/seal/__tests__/fixtures/record-v1.json';
      const built = SealedRecordBuilder.build(fixture.input, new Date(fixture.sealedAt));
      const receipt = VoteReceipt.parse(fixture.receipt);
      if (!built.success || !receipt.success) throw new Error('browser core failed');
      globalThis.sealSmoke = { root: built.value.rootDigest, receipt: receipt.value.bytes };
    `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    platform: 'browser',
    format: 'iife',
    bundle: true,
    write: false,
    target: 'es2022',
    plugins: [
      {
        name: 'no-node-builtins',
        setup(build) {
          build.onResolve(
            { filter: /^(node:|fs$|crypto$|buffer$|path$|util$)/ },
            (args) => ({ errors: [{ text: `Node dependency: ${args.path}` }] })
          );
        },
      },
    ],
  });
  const context = {
    TextEncoder,
    TextDecoder,
    Uint8Array,
    structuredClone,
    sealSmoke: undefined as unknown,
  };
  runInNewContext(result.outputFiles[0].text, context, { timeout: 5000 });
  expect(context.sealSmoke).toEqual({
    root: fixture.record.rootDigest,
    receipt: fixture.receipt,
  });
});
