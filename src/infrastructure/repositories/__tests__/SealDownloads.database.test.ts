/** Four real HTTP handlers with disposable PostgreSQL and a controlled session identity.
 * Exercise weighted receipts, permission gates, independent verification and restart-safe mail delivery. */
import { createBundleDelivery } from '@/infrastructure/email/createBundleDelivery';
import { PrismaBundleDelivery } from '../PrismaBundleDelivery';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { StubEmailSender } from '@/infrastructure/email/StubEmailSender';
import { BundleDelivery } from '@/application/seal/BundleDelivery';
import { SealExports } from '@/application/seal/SealExports';
import { createEvidenceMail } from '@/infrastructure/email/createEvidenceMail';
import { PrismaSealReader } from '../PrismaSealReader';
import { PrismaSealPermissions } from '../PrismaSealPermissions';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { pollDatabase } from './pollDatabase';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { voteReceiptView } from '@/application/poll/VoteReceiptView';
import { Vote } from '@/domain/poll/Vote';
import { PollId } from '@/domain/shared/EntityIds';
import { PollId as SealId } from '@/domain/seal/SealValues';
import { ParticipantId, PollInstant } from '@/domain/poll/PollValues';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import {
  SealLeaseSeconds,
  SealWorkOwner,
} from '@/application/seal/SealWorkRepository';
import { SealPollUseCase } from '@/application/seal/SealPollUseCase';
import { PrismaSealWorkRepository } from '../PrismaSealWorkRepository';
import { PrismaSealingTransaction } from '../PrismaSealingTransaction';
import { createSealRecovery } from '@/infrastructure/anchor/createSealRecovery';
import { readAnchorConfig } from '@/infrastructure/anchor/anchorProviderFactory';
import { verifyEvidence } from '@/domain/seal/VerifyEvidence';
let db: Awaited<ReturnType<typeof pollDatabase>>;
let viewer: string | null = null;
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: async () => (viewer ? { id: viewer } : null),
}));
vi.mock('@/infrastructure/database/prisma', () => ({
  get prisma() {
    return db.prisma;
  },
}));

async function routes() {
  return {
    manifest: (await import('@/src/app/api/polls/[pollId]/seal/manifest/route'))
      .GET,
    proof: (await import('@/src/app/api/polls/[pollId]/seal/proof/route')).GET,
    sections: (await import('@/src/app/api/polls/[pollId]/seal/sections/route'))
      .GET,
    bundle: (await import('@/src/app/api/polls/[pollId]/seal/my-proof/route'))
      .GET,
  };
}

let handlers: Awaited<ReturnType<typeof routes>>;
const roles = [
  'admin',
  'platform',
  'member',
  'voter',
  'other-voter',
  'outsider',
];
beforeAll(async () => {
  db = await pollDatabase();
  handlers = await routes();
  await db.prisma.user.createMany({
    data: roles.map((id) => ({
      id,
      nickname: id,
      phoneNumber: 'phone-' + id,
      password: 'fixture',
      confirmedAt: new Date('2025-01-01'),
      firstName: 'First',
      lastName: 'Name',
    })),
  });
  await db.prisma.organization.create({
    data: { id: 'org', name: 'Org', description: '', createdById: 'admin' },
  });
  await db.prisma.organization.create({
    data: {
      id: 'child',
      name: 'Child',
      description: '',
      createdById: 'admin',
      parentId: 'org',
    },
  });
  await db.prisma.organizationAdminUser.create({
    data: { organizationId: 'org', userId: 'admin' },
  });
  await db.prisma.superAdmin.create({ data: { userId: 'platform' } });
  await db.prisma.organizationUser.create({
    data: { organizationId: 'child', userId: 'member', status: 'accepted' },
  });
}, 30000);
afterAll(async () => {
  await db?.close();
});
const get = (kind: keyof typeof handlers, pollId: string) =>
  handlers[kind](new Request('http://localhost/download?userId=admin'), {
    params: Promise.resolve({ pollId }),
  });

async function finishBallots(anonymous: boolean, open: boolean) {
  const createdAt = new Date('2026-01-01T00:00:00Z'),
    castAt = new Date('2026-01-02T00:00:00Z'),
    finishedAt = new Date('2026-01-03T00:00:00Z');
  const poll = await db.prisma.poll.create({
    data: {
      title: 'Weighted decision',
      description: 'A synthetic poll.',
      createdBy: 'admin',
      organizationId: 'org',
      anonymous,
      pollType: open ? 'OPEN' : 'ORGANIZATION',
      state: 'ACTIVE',
      startDate: createdAt,
      endDate: finishedAt,
      createdAt,
      questions: {
        create: {
          text: 'Proceed?',
          answers: { create: [{ text: 'Yes' }, { text: 'No' }] },
        },
      },
    },
    include: { questions: { include: { answers: true } } },
  });
  const question = poll.questions[0];
  let original = '';

  for (const [index, userId] of ['voter', 'other-voter'].entries()) {
    const weight = open ? 1 : 2.123456 + index;
    const participant = await db.prisma.pollParticipant.create({
      data: {
        userId,
        pollId: poll.id,
        userWeight: weight,
        snapshotAt: createdAt,
      },
    });
    const cast = expectSuccess(
      await new PrismaParticipantRepository(db.prisma).castVotes(
        ParticipantId.parse(participant.id),
        [
          Vote.reconstitute({
            id: randomUUID(),
            questionId: question.id,
            answerId: question.answers[index].id,
            userId,
            userWeight: weight,
            createdAt: castAt,
          }),
        ],
        index === 0,
        ReceiptSecret.parse((index ? '02' : '01').repeat(32))
      )
    );
    const receipt = expectSuccess(voteReceiptView(cast));

    if (!index && receipt.kind === 'original') {
      original = receipt.canonicalReceipt;
    }
  }

  const polls = new PrismaPollRepository(db.prisma);
  const aggregate = expectSuccess(
    await polls.getPollById(PollId.parse(poll.id))
  );

  if (!aggregate) {
    throw Error('Missing fixture poll');
  }

  expectSuccess(aggregate.finish(PollInstant.parse(finishedAt.toISOString())));
  expectSuccess(await polls.updatePoll(aggregate));

  return { id: poll.id, original };
}

async function finishPoll(anonymous: boolean, open: boolean) {
  const poll = await finishBallots(anonymous, open);
  const seal = expectSuccess(
    await new SealPollUseCase(
      new PrismaSealWorkRepository(db.prisma),
      new PrismaSealingTransaction(db.prisma)
    ).execute({
      pollId: SealId.parse(poll.id),
      owner: SealWorkOwner.parse('test'),
      lease: SealLeaseSeconds.parse(60),
    })
  );

  if (seal.status !== 'sealed') {
    throw Error('Missing fixture seal');
  }

  return { ...poll, manifest: seal.seal.manifestBytes };
}

it.each([
  [true, false],
  [false, false],
  [true, true],
  [false, true],
])(
  'enforces disclosure with anonymous=%s and open=%s',
  async (anonymous, open) => {
    const f = await finishPoll(anonymous, open);
    viewer = null;
    const pub = await get('manifest', f.id);
    expect(pub.status).toBe(200);
    expect(await pub.text()).toBe(f.manifest);
    expect((await get('sections', f.id)).status).toBe(403);
    expect((await get('bundle', f.id)).status).toBe(403);
    const missing = await get('proof', f.id);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: 'seal.errors.anchorUnavailable',
    });

    for (const role of roles) {
      viewer = role;
      const admin = role === 'admin' || role === 'platform';
      const voter = role === 'voter' || role === 'other-voter';
      const readable = admin || role === 'member' || (open && voter);
      const response = await get('sections', f.id);
      expect(response.status).toBe(readable ? 200 : 403);

      if (readable) {
        const text = await response.text();
        expect(text).not.toContain('receiptSecret');
        const s = JSON.parse(text).sections;
        expect(typeof s.poll).toBe('string');
        expect(typeof s.tallies).toBe('string');
        expect('register' in s).toBe(admin || !anonymous);
        expect('votes' in s).toBe(admin || !anonymous);
        expect('signers' in s).toBe(admin);
        expect(text.includes('phone-voter')).toBe(admin);
        expect(verifyEvidence({ sections: text }).success).toBe(true);
      }

      const own = await get('bundle', f.id);
      expect(own.status).toBe(voter ? 200 : 403);

      if (voter) {
        const text = await own.text();
        const b = JSON.parse(text);
        expect(b.leaves).toHaveLength(1);
        expect(b.leaves[0].preimage.userId).toBe(role);
        expect('poll' in b).toBe(readable);
        expect(text).not.toContain('"register":[');
        expect(text).not.toContain('phone-');
        expect(text).not.toContain('receiptSecret');
      }
    }
  }
);
it('casts a weighted ballot, exports its permitted evidence, and verifies the saved original in an isolated CLI process', async () => {
  const f = await finishPoll(true, false);
  await db.prisma.organizationUser.create({
    data: { organizationId: 'org', userId: 'voter', status: 'accepted' },
  });
  const config = expectSuccess(
    readAnchorConfig({
      NODE_ENV: 'test',
      ANCHOR_PROVIDER:
        process.env.OTS_LIVE_TEST === '1' ? 'opentimestamps' : 'stub',
    })
  );
  const recovered = await createSealRecovery(db.prisma, config).process({
    kind: 'anchor',
    pollId: SealId.parse(f.id),
  });
  expect(expectSuccess(recovered)).toBe('submitted');
  viewer = 'voter';
  const dir = await mkdtemp(join(tmpdir(), 'resolutio-cast-export-'));

  try {
    const bundle = await (await get('bundle', f.id)).text();
    const sections = await (await get('sections', f.id)).text();
    const manifest = await (await get('manifest', f.id)).text();
    const response = await get('proof', f.id);
    expect(response.status).toBe(200);
    const proof = new Uint8Array(await response.arrayBuffer());
    const status = config.provider === 'stub' ? 'simulated' : 'pending';
    expect(response.headers.get('x-seal-anchor')).toBe(status);
    expect(JSON.parse(f.original).leaves[0].preimage.weight).toBe('2.123456');
    expect(Object.keys(JSON.parse(sections).sections).sort()).toEqual([
      'poll',
      'tallies',
    ]);

    for (const [file, data] of Object.entries({
      'receipt.json': f.original,
      'manifest.json': manifest,
      'bundle.json': bundle,
      'sections.json': sections,
      'manifest.json.ots': proof,
    })) {
      await writeFile(join(dir, file), data);
    }

    await build({
      entryPoints: ['scripts/verify-seal.ts'],
      outfile: join(dir, 'verify-seal.mjs'),
      platform: 'node',
      format: 'esm',
      target: 'node20',
      bundle: true,
    });
    const args = [
      'verify-seal.mjs',
      '--manifest',
      'manifest.json',
      '--receipt',
      'receipt.json',
      '--bundle',
      'bundle.json',
      '--sections',
      'sections.json',
      '--proof',
      'manifest.json.ots',
    ];
    const run = () =>
      spawnSync(process.execPath, args, {
        cwd: dir,
        // Next augments ProcessEnv with a required NODE_ENV. The standalone CLI needs none.
        env: {} as NodeJS.ProcessEnv,
        encoding: 'utf8',
      });
    const valid = run();
    expect(valid.status, valid.stderr).toBe(0);
    expect(JSON.parse(valid.stdout)).toMatchObject({
      ballot: 'originalReceiptMatches',
      timestamp: status,
    });
    await writeFile(join(dir, 'manifest.json'), manifest + ' ');
    expect(run().status).toBe(1);
    await db.prisma.organizationUser.delete({
      where: {
        organizationId_userId: { organizationId: 'org', userId: 'voter' },
      },
    });
    const afterLoss = await (await get('bundle', f.id)).text();
    expect(JSON.parse(afterLoss)).not.toHaveProperty('poll');
    expect(
      verifyEvidence({ bundle: afterLoss, receipt: f.original })
    ).toMatchObject({
      success: true,
      value: { ballot: 'originalReceiptMatches', labels: 'unavailable' },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);

it('serves the public commitment even when a private section cannot be rehydrated', async () => {
  const f = await finishPoll(true, false);
  const row = await db.prisma.pollSeal.findUniqueOrThrow({
    where: { pollId: f.id },
  });
  // Build a separate corrupted storage fixture. The immutable original stays intact.
  const second = await db.prisma.poll.create({
    data: {
      title: 'Historical capture',
      description: 'Test',
      anonymous: true,
      organizationId: 'org',
      createdBy: 'admin',
      state: 'FINISHED',
      startDate: new Date(),
      endDate: new Date(),
      finishedAt: new Date(),
    },
  });
  const { canonical } = await import('@/domain/seal/Canonical');
  const { hashText } = await import('@/domain/seal/Hash');
  const manifest = canonical({
    ...JSON.parse(row.manifest),
    pollId: second.id,
  });
  await db.prisma.pollSeal.create({
    data: {
      pollId: second.id,
      rootDigest: hashText(manifest),
      manifest,
      sectionPoll: row.sectionPoll,
      sectionTallies: row.sectionTallies,
      sectionRegister: row.sectionRegister,
      sectionSigners: row.sectionSigners,
      votes: [],
      sealedAt: row.sealedAt,
    },
  });
  viewer = null;
  expect(await (await get('manifest', second.id)).text()).toBe(manifest);
});

const deliveryConfig = expectSuccess(
  readAnchorConfig({ NODE_ENV: 'test', ANCHOR_PROVIDER: 'stub' })
);
const confirmVoter = () =>
  db.prisma.user.update({
    where: { id: 'voter' },
    data: { email: 'voter@example.org', emailConfirmedAt: new Date() },
  });

it('discovers the first bundle after delayed submission and claims it once across workers', async () => {
  const f = await finishPoll(true, false);
  const pollId = SealId.parse(f.id);
  const sender = { send: vi.fn().mockResolvedValue({ success: true }) };
  const worker = () => createBundleDelivery(db.prisma, sender);
  await confirmVoter();
  expect(expectSuccess(await worker().recover(20, pollId))).toBe(0);
  const anchored = await createSealRecovery(db.prisma, deliveryConfig).process({
    kind: 'anchor',
    pollId,
  });
  expect(expectSuccess(anchored)).toBe('submitted');
  await Promise.all([
    worker().recover(20, pollId),
    worker().recover(20, pollId),
  ]);
  expect(sender.send).toHaveBeenCalledTimes(1);
  expect(expectSuccess(await worker().recover(20, pollId))).toBe(0);
  const [message] = sender.send.mock.calls[0];
  const [bundle, proof] = message.attachments;
  expect(bundle.filename).toBe('bundle.json');
  expect(proof.filename).toBe(f.id + '.ots');
  expect(
    verifyEvidence({
      bundle: bundle.content,
      proof: proof.content,
      receipt: f.original,
    })
  ).toMatchObject({
    success: true,
    value: {
      ballot: 'originalReceiptMatches',
      labels: 'unavailable',
      timestamp: 'simulated',
    },
  });
  expect(message.text).not.toContain('Weighted decision');
  expect(bundle.content).not.toContain('other-voter');
  expect(bundle.content).not.toContain('receiptSecret');
  expect(
    await db.prisma.sealBundleDelivery.findUniqueOrThrow({
      where: { pollId_userId: { pollId, userId: 'voter' } },
    })
  ).toMatchObject({ status: 'SENT' });
});

it('leaves unsent work pending while an address is unconfirmed and uses current permissions and address on recovery', async () => {
  const f = await finishPoll(false, false);
  const pollId = SealId.parse(f.id);
  const sender = { send: vi.fn().mockResolvedValue({ success: true }) };
  const store = new PrismaBundleDelivery(db.prisma);
  const who = { id: 'voter' };
  await db.prisma.user.update({
    where: who,
    data: { email: 'old@example.org', emailConfirmedAt: new Date() },
  });
  expect(
    expectSuccess(
      await createSealRecovery(db.prisma, deliveryConfig, sender).process({
        kind: 'anchor',
        pollId,
      })
    )
  ).toBe('submitted');
  const [key] = expectSuccess(await store.discover(20, pollId));
  await db.prisma.user.update({
    where: who,
    data: { email: 'new@example.org', emailConfirmedAt: null },
  });
  expect(
    expectSuccess(
      await store.claim(key, {
        address: EmailAddress.create('old@example.org'),
        language: 'ru',
      })
    )
  ).toBe(false);
  expect(
    expectSuccess(
      await createBundleDelivery(db.prisma, sender).recover(20, pollId)
    )
  ).toBe(0);
  await db.prisma.user.update({
    where: who,
    data: { emailConfirmedAt: new Date() },
  });
  await db.prisma.organizationAdminUser.create({
    data: { organizationId: 'org', userId: 'voter' },
  });

  try {
    expect(
      expectSuccess(
        await createBundleDelivery(db.prisma, sender).recover(20, pollId)
      )
    ).toBe(1);
    const message = sender.send.mock.calls[0][0];
    expect(message.to.getValue()).toBe('new@example.org');
    const b = JSON.parse(message.attachments[0].content);
    expect(Object.keys(b).sort()).toEqual([
      'leaves',
      'manifest',
      'poll',
      'rootDigest',
    ]);
    expect(
      b.leaves.every(
        (v: { preimage: { userId: string } }) => v.preimage.userId === 'voter'
      )
    ).toBe(true);
    expect(message.text).toContain('Weighted decision');
    expect(message.attachments[0].content).not.toContain('phone-voter');
  } finally {
    await db.prisma.organizationAdminUser.delete({
      where: {
        organizationId_userId: { organizationId: 'org', userId: 'voter' },
      },
    });
  }
});

it.each(['before SMTP', 'during SMTP', 'after acceptance'] as const)(
  'marks a lost worker %s UNKNOWN and rejects late completion',
  async (point) => {
    const f = await finishPoll(true, false);
    const pollId = SealId.parse(f.id);
    await confirmVoter();
    const send = vi.fn().mockResolvedValue({ success: true });
    await createSealRecovery(db.prisma, deliveryConfig, { send }).process({
      kind: 'anchor',
      pollId,
    });
    const store = new PrismaBundleDelivery(db.prisma);
    const [key] = expectSuccess(await store.discover(20, pollId));
    // Hold the original worker at one of the actual handoff boundaries.
    let release!: () => void;
    let signal!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      signal = resolve;
    });

    const hold = async () => {
      signal();
      await held;
    };

    if (point === 'before SMTP') {
      const claim = store.claim.bind(store);
      vi.spyOn(store, 'claim').mockImplementation(async (...args) => {
        expect(expectSuccess(await claim(...args))).toBe(true);
        await hold();

        // The process died here. It never returned the claim to its caller.
        return { success: false, error: 'common.errors.unexpected' };
      });
    } else if (point === 'during SMTP') {
      send.mockImplementationOnce(async () => {
        await hold();

        return { success: true };
      });
    } else {
      const complete = store.complete.bind(store);
      vi.spyOn(store, 'complete').mockImplementation(async (...args) => {
        await hold();

        return complete(...args);
      });
    }

    const original = new BundleDelivery(
      store,
      createEvidenceMail(db.prisma, { send }),
      new SealExports(
        new PrismaSealReader(db.prisma),
        new PrismaSealPermissions(db.prisma)
      )
    );
    const running = original.recover(20, pollId);
    await reached;
    await db.prisma.sealBundleDelivery.update({
      where: { pollId_userId: key },
      data: { attemptStartedAt: new Date(Date.now() - 11 * 60000) },
    });
    const before = send.mock.calls.length;
    expect(
      expectSuccess(
        await createBundleDelivery(db.prisma, { send }).recover(20, pollId)
      )
    ).toBe(0);
    release();
    await running;
    expect(send).toHaveBeenCalledTimes(before);
    expect(expectSuccess(await store.complete(key, 'SENT'))).toBe(false);
    expect(
      await db.prisma.sealBundleDelivery.findUniqueOrThrow({
        where: { pollId_userId: key },
      })
    ).toMatchObject({ status: 'UNKNOWN', lastError: 'attemptExpired' });
  }
);

it.each([
  ['FAILED', false],
  ['UNKNOWN', true],
] as const)(
  'keeps a transport outcome %s terminal across later scans',
  async (status, uncertain) => {
    const f = await finishPoll(true, false);
    const pollId = SealId.parse(f.id);
    const sender = {
      send: vi.fn().mockResolvedValue({ success: false, uncertain }),
    };
    await confirmVoter();
    // Re-enter the production immediate path after a restart with an already saved seal.
    const immediate = createSealRecovery(db.prisma, deliveryConfig, sender);
    await immediate.process({ kind: 'seal', pollId });
    await immediate.deliverForPoll(pollId);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(
      expectSuccess(
        await createBundleDelivery(db.prisma, sender).recover(20, pollId)
      )
    ).toBe(0);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(
      await db.prisma.sealBundleDelivery.findUniqueOrThrow({
        where: { pollId_userId: { pollId, userId: 'voter' } },
      })
    ).toMatchObject({ status });
  }
);

it('keeps the first bundle pending until an attachment transport is configured', async () => {
  const f = await finishPoll(true, false);
  const pollId = SealId.parse(f.id);
  await confirmVoter();
  const immediate = createSealRecovery(
    db.prisma,
    deliveryConfig,
    new StubEmailSender()
  );
  await immediate.process({ kind: 'seal', pollId });
  await immediate.deliverForPoll(pollId);
  expect(
    await db.prisma.sealBundleDelivery.findUniqueOrThrow({
      where: { pollId_userId: { pollId, userId: 'voter' } },
    })
  ).toMatchObject({ status: 'PENDING' });
  const sender = { send: vi.fn().mockResolvedValue({ success: true }) };
  expect(
    expectSuccess(
      await createBundleDelivery(db.prisma, sender).recover(20, pollId)
    )
  ).toBe(1);
});

it('recovers a finished poll with no seal and delivers a verifiable first bundle in the cron batch', async () => {
  const f = await finishBallots(true, false);
  await confirmVoter();
  expect(
    await db.prisma.pollSeal.findUnique({ where: { pollId: f.id } })
  ).toBeNull();
  const send = vi.fn().mockResolvedValue({ success: true });
  const restart = () => createSealRecovery(db.prisma, deliveryConfig, { send });
  const result = expectSuccess(await restart().execute());
  expect(result.deliveries).toBeGreaterThan(0);
  const messages = () =>
    send.mock.calls
      .map(([m]) => m)
      .filter((m) => m.attachments[1].filename === f.id + '.ots');
  expect(messages()).toHaveLength(1);
  const [bundle, proof] = messages()[0].attachments;
  expect(
    verifyEvidence({
      bundle: bundle.content,
      proof: proof.content,
      receipt: f.original,
    })
  ).toMatchObject({
    success: true,
    value: { ballot: 'originalReceiptMatches', timestamp: 'simulated' },
  });
  await restart().execute();
  expect(messages()).toHaveLength(1);
});

it('rotates pending preparation work so an unreadable record cannot block later recipients', async () => {
  const f = await finishPoll(true, false),
    pollId = SealId.parse(f.id);
  await confirmVoter();
  await db.prisma.user.update({
    where: { id: 'other-voter' },
    data: { email: 'second@example.org', emailConfirmedAt: new Date() },
  });

  try {
    await createSealRecovery(
      db.prisma,
      deliveryConfig,
      new StubEmailSender()
    ).process({ kind: 'anchor', pollId });
    const store = new PrismaBundleDelivery(db.prisma);
    const [first] = expectSuccess(await store.discover(1, pollId));
    // A worker stops before claiming its prepared message. Next scan must make progress.
    const [second] = expectSuccess(await store.discover(1, pollId));
    expect(first.userId).not.toBe(second.userId);
    expect(expectSuccess(await store.discover(1, pollId))).toEqual([first]);
  } finally {
    await db.prisma.user.update({
      where: { id: 'other-voter' },
      data: { emailConfirmedAt: null },
    });
  }
});
