/** Four real HTTP handlers with disposable PostgreSQL and a controlled session identity.
 * Exercise weighted cast-time evidence, membership loss, actual policy gates and a clean CLI process. */
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

async function finishPoll(anonymous: boolean, open: boolean) {
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

  return { id: poll.id, manifest: seal.seal.manifestBytes, original };
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
