/** Exercises the real OTS wire codec and HTTP integration against controlled endpoints.
 * Retained proofs come from opentimestamps 0.4.9's examples directory. */
import { readFileSync } from 'node:fs';
import { createServer, type RequestListener } from 'node:http';
import { expect, it } from 'vitest';
import { readAnchorConfig } from '../anchorProviderFactory';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { AnchorProof, Digest } from '@/domain/seal/SealValues';
import { OpenTimestampsAnchorProvider } from '../OpenTimestampsAnchorProvider';

const pending = AnchorProof.parse(
  readFileSync(new URL('./fixtures/incomplete.txt.ots', import.meta.url))
);
const digest = Digest.parse(
  '05c4f616a8e5310d19d938cfd769864d7f4ccdc2ca8b479b10af83564b097af9'
);
const provider = new OpenTimestampsAnchorProvider({
  calendars: ['http://127.0.0.1:1'],
  esploraUrl: 'http://127.0.0.1:1',
  timeoutMs: 3000,
});

it('rejects a genuine detached timestamp for another manifest', async () => {
  expect(
    (await provider.upgrade(Digest.parse('00'.repeat(32)), pending)).success
  ).toBe(false);
});

it('retains a pending calendar receipt when no upgrade exists', async () => {
  const http = await endpoint((_req, res) => res.writeHead(404).end());

  try {
    expect(await http.provider.upgrade(digest, pending)).toMatchObject({
      success: true,
      value: { kind: 'pending', rootDigest: digest, proof: pending },
    });
  } finally {
    await http.close();
  }
});

const completed = AnchorProof.parse(
  readFileSync(new URL('./fixtures/hello-world.txt.ots', import.meta.url))
);
const original = Digest.parse(
  '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340'
);

it('keeps completed bytes pending with an error when the explorer is unavailable', async () => {
  expect(await provider.upgrade(original, completed)).toMatchObject({
    success: true,
    value: {
      kind: 'pending',
      proof: completed,
      verificationError: 'seal.errors.anchorVerificationFailed',
    },
  });
});

it('rejects an unsuccessful calendar submission', async () => {
  expect((await provider.submit(digest)).success).toBe(false);
});

it.runIf(process.env.OTS_LIVE_TEST === '1')(
  'submits a fresh synthetic digest to public calendars',
  async () => {
    const { randomBytes } = await import('node:crypto');
    const live = liveProvider();
    const root = Digest.parse(randomBytes(32).toString('hex'));
    const receipt = expectSuccess(await live.submit(root));
    expect(receipt.kind).toBe('pending');
    const refreshed = expectSuccess(await live.upgrade(root, receipt.proof));
    expect(refreshed.rootDigest).toBe(root);
    console.info(
      'Public OTS submission',
      root,
      'first upgrade',
      refreshed.kind
    );
  },
  60000
);
it.runIf(process.env.OTS_LIVE_TEST === '1')(
  'verifies a retained public Bitcoin proof via Esplora',
  async () => {
    expect(await liveProvider().upgrade(original, completed)).toMatchObject({
      success: true,
      value: { kind: 'bitcoin', bitcoinHeight: 358391 },
    });
  },
  60000
);

function liveProvider() {
  const settings = readAnchorConfig({
    ...process.env,
    ANCHOR_PROVIDER: 'opentimestamps',
  });

  return new OpenTimestampsAnchorProvider(expectSuccess(settings));
}

it('verifies a retained proof against the configured explorer and rejects a different Merkle root', async () => {
  let merkleRoot =
    '8a1b66ecb7cbd07d8139a7e7d7f2c41aab1f5009b8364aaf61d03ad245e47e00';
  const http = await endpoint((req, res) => {
    if (req.url === '/api/block-height/358391') {
      res.end('historical-block');
    } else if (req.url === '/api/block/historical-block') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ merkle_root: merkleRoot, timestamp: 1430000000 })
      );
    } else {
      res.writeHead(404).end();
    }
  });

  try {
    expect(await http.provider.upgrade(original, completed)).toMatchObject({
      success: true,
      value: {
        kind: 'bitcoin',
        bitcoinHeight: 358391,
        bitcoinTime: '2015-04-25T22:13:20.000Z',
      },
    });
    merkleRoot = '11'.repeat(32);
    expect(await http.provider.upgrade(original, completed)).toMatchObject({
      success: true,
      value: {
        kind: 'pending',
        verificationError: 'seal.errors.anchorVerificationFailed',
      },
    });
  } finally {
    await http.close();
  }
});

it('retains newly upgraded bytes when a calendar supplies an unverified Bitcoin attestation', async () => {
  const http = await endpoint((req, res) => {
    if (req.url?.startsWith('/timestamp/')) {
      res.end(Buffer.from('000588960d73d7190103f7ef15', 'hex'));
    } else {
      res.writeHead(503).end();
    }
  });

  try {
    const output = expectSuccess(await http.provider.upgrade(digest, pending));
    expect(output.kind).toBe('pending');
    expect(output.proof).not.toEqual(pending);
    expect(output).toHaveProperty('verificationError');
  } finally {
    await http.close();
  }
});

it('produces a detached SHA-256 proof for the original digest on calendar acceptance', async () => {
  const http = await endpoint((req, res) => {
    if (req.method === 'POST' && req.url === '/digest') {
      req.resume();
      res.end(
        Buffer.from(
          '0083dfe30d2ef90c8e191868747470733a2f2f63616c656e6461722e6578616d706c65',
          'hex'
        )
      );
    } else {
      res.writeHead(404).end();
    }
  });

  try {
    const receipt = expectSuccess(await http.provider.submit(digest));
    expect(
      expectSuccess(await http.provider.upgrade(digest, receipt.proof))
    ).toMatchObject({ kind: 'pending', rootDigest: digest });
  } finally {
    await http.close();
  }
});

it('terminates a calendar call that never replies', async () => {
  const http = await endpoint(() => {}, 500);

  try {
    const result = await http.provider.submit(digest);
    expect(result.success).toBe(false);
  } finally {
    await http.close();
  }
}, 3000);

async function endpoint(handler: RequestListener, timeoutMs = 3000) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw Error('Missing local HTTP port');
  }

  const base = 'http://127.0.0.1:' + address.port;

  return {
    provider: new OpenTimestampsAnchorProvider({
      calendars: [base],
      esploraUrl: base + '/api',
      timeoutMs,
    }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

it('distinguishes unavailable upgrade calendars from a calendar with no newer proof', async () => {
  expect(await provider.upgrade(digest, pending)).toMatchObject({
    success: false,
    error: 'seal.errors.anchorUpgradeFailed',
  });
});

it('rejects simulated bytes and truncated OTS files', async () => {
  const simulated = AnchorProof.parse(Buffer.from('SIMULATED:' + original));
  const truncated = AnchorProof.parse(completed.subarray(0, 30));

  for (const bytes of [simulated, truncated]) {
    expect(await provider.upgrade(original, bytes)).toMatchObject({
      success: false,
      error: 'domain.seal.invalidProof',
    });
  }
});
