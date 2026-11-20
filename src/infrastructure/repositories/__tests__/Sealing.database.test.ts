/** End-to-end sealing acceptance using persisted ballots and mutable metadata.
 * Each test uses a migrated disposable schema; no application database is read. */
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { ParticipantId } from '@/domain/poll/PollValues';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { Vote } from '@/domain/poll/Vote';
import { voteReceiptView } from '@/application/poll/VoteReceiptView';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import { PrismaSealingTransaction } from '../PrismaSealingTransaction';
import { PrismaSealWorkRepository } from '../PrismaSealWorkRepository';
import { SealPollUseCase } from '@/application/seal/SealPollUseCase';
import {
  SealWorkOwner,
  SealLeaseSeconds,
} from '@/application/seal/SealWorkRepository';
import { PollId } from '@/domain/seal/SealValues';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';

let db: Awaited<ReturnType<typeof pollDatabase>>;
beforeAll(async () => {
  db = await pollDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function fixture() {
  const stamp = randomUUID();
  const createdAt = new Date('2026-09-10T00:00:00.000Z');
  const snapshotAt = new Date('2026-09-10T01:00:00.000Z');
  const castAt = new Date('2026-09-10T02:00:00.000Z');
  const finishedAt = new Date('2026-09-10T03:00:00.000Z');
  const user = await db.prisma.user.create({
    data: {
      firstName: 'Before',
      lastName: 'Voter',
      nickname: stamp,
      phoneNumber: stamp,
      password: 'fixture',
    },
  });
  const org = await db.prisma.organization.create({
    data: { name: stamp, description: 'Test', createdById: user.id },
  });
  const property = await db.prisma.organizationProperty.create({
    data: { organizationId: org.id, name: 'Building', sizeUnit: 'm2' },
  });
  const asset = await db.prisma.propertyAsset.create({
    data: { propertyId: property.id, name: 'Unit', size: '25.123456' },
  });
  await db.prisma.propertyAssetOwnership.create({
    data: {
      assetId: asset.id,
      userId: user.id,
      share: '0.50000000',
      effectiveFrom: createdAt,
      effectiveUntil: castAt,
    },
  });
  await db.prisma.propertyAssetOwnership.create({
    data: {
      assetId: asset.id,
      userId: user.id,
      share: '1.00000000',
      effectiveFrom: castAt,
    },
  });
  const poll = await db.prisma.poll.create({
    data: {
      title: 'Poll',
      description: '',
      organizationId: org.id,
      createdBy: user.id,
      createdAt,
      startDate: createdAt,
      endDate: finishedAt,
      state: 'ACTIVE',
      questions: {
        create: [
          {
            text: 'Decision?',
            answers: {
              create: [{ text: 'Yes' }, { text: 'Old', archivedAt: createdAt }],
            },
          },
          {
            text: 'Old question',
            archivedAt: createdAt,
            answers: { create: { text: 'Old' } },
          },
        ],
      },
      attachments: {
        create: {
          fileName: 'rules.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 3,
          bytes: new Uint8Array([1, 2, 3]),
        },
      },
    },
    include: { attachments: true, questions: { include: { answers: true } } },
  });
  const question = poll.questions.find((q) => q.archivedAt === null)!;
  const answer = question.answers.find((a) => a.archivedAt === null)!;
  const receiptSecret = 'ab'.repeat(32);
  const participant = await db.prisma.pollParticipant.create({
    data: {
      pollId: poll.id,
      userId: user.id,
      userWeight: '2.123456',
      snapshotAt,
      receiptSecret,
      willingToSignProtocol: true,
    },
  });
  const cast = expectSuccess(
    await new PrismaParticipantRepository(db.prisma).castVotes(
      ParticipantId.parse(participant.id),
      [
        Vote.reconstitute({
          id: randomUUID(),
          questionId: question.id,
          answerId: answer.id,
          userId: user.id,
          userWeight: 2.123456,
          createdAt: castAt,
        }),
      ],
      true,
      ReceiptSecret.parse(receiptSecret)
    )
  );
  const receipt = expectSuccess(voteReceiptView(cast));

  if (receipt.kind !== 'original') {
    return expect.unreachable();
  }

  await db.prisma.poll.update({
    where: { id: poll.id },
    data: { state: 'FINISHED', finishedAt },
  });
  const work = new PrismaSealWorkRepository(db.prisma);
  const transaction = new PrismaSealingTransaction(db.prisma);
  const useCase = new SealPollUseCase(work, transaction);
  const command = {
    pollId: PollId.parse(poll.id),
    owner: SealWorkOwner.parse(stamp),
    lease: SealLeaseSeconds.parse(60),
  };

  return {
    poll,
    user,
    org,
    property,
    asset,
    question,
    answer,
    receiptSecret,
    receipt: receipt.receipt,
    useCase,
    command,
    work,
    transaction,
  };
}

it('captures late metadata, archived definitions, exact weights and historical holdings once', async () => {
  const f = await fixture();
  await db.prisma.user.update({
    where: { id: f.user.id },
    data: { firstName: 'At seal' },
  });
  const result = expectSuccess(await f.useCase.execute(f.command));

  if (result.status !== 'sealed') {
    return expect.unreachable();
  }

  const record = result.seal.record;
  const poll = JSON.parse(record.sections.poll);
  const register = JSON.parse(record.sections.register);
  expect(poll.questions).toHaveLength(2);
  expect(
    poll.questions.flatMap((q: { answers: unknown[] }) => q.answers)
  ).toHaveLength(3);
  expect(poll.attachments).toEqual([
    {
      id: f.poll.attachments?.[0]?.id,
      fileName: 'rules.pdf',
      size: 3,
      mimeType: 'application/pdf',
    },
  ]);
  expect(register[0]).toMatchObject({
    firstName: 'At seal',
    weight: '2.123456',
    holdings: [{ share: '0.50000000', size: '25.123456', assetName: 'Unit' }],
  });
  expect(JSON.parse(record.sections.signers)[0].phoneNumber).toBe(
    f.user.phoneNumber
  );
  expect(JSON.stringify(record)).not.toContain(f.receiptSecret);
  await db.prisma.user.update({
    where: { id: f.user.id },
    data: { firstName: 'Later', phoneNumber: randomUUID() },
  });
  await db.prisma.propertyAsset.update({
    where: { id: f.asset.id },
    data: { name: 'Renamed', size: 99 },
  });
  const again = expectSuccess(await f.useCase.execute(f.command));

  if (again.status !== 'sealed') {
    return expect.unreachable();
  }

  expect(again.seal.record).toEqual(record);
});

it('keeps a consistent snapshot during concurrent metadata changes and rolls back failures', async () => {
  const f = await fixture();
  const { SealedRecordBuilder } =
    await import('@/domain/seal/SealedRecordBuilder');
  const { failure } = await import('@/domain/shared/Result');
  const claim = expectSuccess(
    await f.work.acquire(f.command.pollId, f.command.owner, f.command.lease)
  );

  if (!claim) {
    return expect.unreachable();
  }

  const failed = await f.transaction.run(claim, async (scope) => {
    const before = expectSuccess(
      await scope.snapshot.read(f.command.pollId, scope.capturedAt)
    );

    if (!before) {
      return expect.unreachable();
    }

    await db.prisma.user.update({
      where: { id: f.user.id },
      data: { firstName: 'Concurrent' },
    });
    const after = expectSuccess(
      await scope.snapshot.read(f.command.pollId, scope.capturedAt)
    );
    expect(after).toEqual(before);
    const seal = expectSuccess(
      SealedRecordBuilder.build(before, new Date(scope.capturedAt))
    );
    expectSuccess(await scope.seals.save(seal));

    return failure('test.rollback');
  });
  expect(failed).toEqual({ success: false, error: 'test.rollback' });
  expect(await db.prisma.pollSeal.count({ where: { pollId: f.poll.id } })).toBe(
    0
  );
  expectSuccess(await f.work.release(claim));
  const retried = expectSuccess(await f.useCase.execute(f.command));

  if (retried.status !== 'sealed') {
    return expect.unreachable();
  }

  expect(JSON.parse(retried.seal.record.sections.register)[0].firstName).toBe(
    'Concurrent'
  );
});

it('serializes concurrent sealing and returns the original seal on later retries', async () => {
  const f = await fixture();
  const results = await Promise.all([
    f.useCase.execute(f.command),
    f.useCase.execute({
      ...f.command,
      owner: SealWorkOwner.parse(randomUUID()),
    }),
  ]);
  const outcomes = results.map(expectSuccess);
  expect(outcomes.some((o) => o.status === 'sealed')).toBe(true);
  expect(await db.prisma.pollSeal.count({ where: { pollId: f.poll.id } })).toBe(
    1
  );
  const again = expectSuccess(await f.useCase.execute(f.command));

  if (again.status !== 'sealed') {
    return expect.unreachable();
  }

  for (const outcome of outcomes) {
    if (outcome.status === 'sealed') {
      expect(outcome.seal.record).toEqual(again.seal.record);
    }
  }
});

it('matches the cast receipt leaves after persisting and reloading the complete seal', async () => {
  const f = await fixture();
  const result = expectSuccess(await f.useCase.execute(f.command));

  if (result.status !== 'sealed') {
    return expect.unreachable();
  }

  expect(result.seal.record.votes).toEqual(
    f.receipt.leaves.map(({ preimage, hash }) => ({ preimage, hash }))
  );
});

it.each(['ACTIVE', 'FINISHED'] as const)(
  'rejects %s without a valid finish cutoff',
  async (state) => {
    const f = await fixture();
    const legacy = await db.prisma.poll.create({
      data: {
        title: 'Legacy',
        description: '',
        organizationId: f.org.id,
        createdBy: f.user.id,
        state,
        startDate: new Date(),
        endDate: new Date(),
      },
    });
    const result = await f.useCase.execute({
      ...f.command,
      pollId: PollId.parse(legacy.id),
    });
    expect(result).toEqual({
      success: false,
      error: 'domain.seal.pollNotFinished',
    });
    expect(
      await db.prisma.pollSeal.count({ where: { pollId: legacy.id } })
    ).toBe(0);
  }
);

it('includes nonvoters and resolves descendant holdings at each participant snapshot', async () => {
  const f = await fixture();
  const nonvoter = await db.prisma.user.create({
    data: {
      firstName: 'Nonvoter',
      lastName: 'Member',
      nickname: randomUUID(),
      phoneNumber: randomUUID(),
      password: 'fixture',
    },
  });
  const child = await db.prisma.organization.create({
    data: {
      name: randomUUID(),
      description: 'Child',
      parentId: f.org.id,
      createdById: f.user.id,
    },
  });
  const property = await db.prisma.organizationProperty.create({
    data: { organizationId: child.id, name: 'Child property', sizeUnit: 'm2' },
  });
  const asset = await db.prisma.propertyAsset.create({
    data: { propertyId: property.id, name: 'Child unit', size: 10 },
  });
  await db.prisma.propertyAssetOwnership.create({
    data: {
      assetId: asset.id,
      userId: nonvoter.id,
      share: '0.25000000',
      effectiveFrom: new Date('2026-09-10T00:00:00.000Z'),
    },
  });
  await db.prisma.pollParticipant.create({
    data: {
      pollId: f.poll.id,
      userId: nonvoter.id,
      userWeight: '1.000001',
      snapshotAt: new Date('2026-09-10T02:00:00.000Z'),
    },
  });
  const board = await db.prisma.board.create({
    data: { name: 'Council', organizationId: f.org.id },
  });
  await db.prisma.poll.update({
    where: { id: f.poll.id },
    data: { boardId: board.id },
  });
  const result = expectSuccess(await f.useCase.execute(f.command));

  if (result.status !== 'sealed') {
    return expect.unreachable();
  }

  const register = JSON.parse(result.seal.record.sections.register);
  expect(register).toHaveLength(2);
  expect(
    register.find((p: { userId: string }) => p.userId === nonvoter.id)
  ).toMatchObject({
    voted: false,
    weight: '1.000001',
    holdings: [{ propertyId: property.id, share: '0.25000000' }],
  });
  expect(JSON.parse(result.seal.record.sections.poll)).toMatchObject({
    boardId: board.id,
    boardName: 'Council',
  });
  expect(JSON.parse(result.seal.record.sections.signers)).toHaveLength(1);
});

it('seals zero-share source ownership without removing the voter or changing their receipt', async () => {
  const f = await fixture();
  await db.prisma.propertyAssetOwnership.updateMany({
    where: { assetId: f.asset.id, effectiveUntil: { not: null } },
    data: { share: '0.00000000' },
  });
  const result = expectSuccess(await f.useCase.execute(f.command));

  if (result.status !== 'sealed') {
    return expect.unreachable();
  }

  expect(JSON.parse(result.seal.record.sections.register)).toMatchObject([
    { userId: f.user.id, weight: '2.123456', voted: true, holdings: [] },
  ]);
  expect(result.seal.record.votes).toEqual(
    f.receipt.leaves.map(({ preimage, hash }) => ({ preimage, hash }))
  );
  expect(
    await db.prisma.propertyAssetOwnership.count({
      where: { assetId: f.asset.id, share: '0.00000000' },
    })
  ).toBe(1);
});

it('recovers interrupted seal, submission and due upgrade from stored state with fresh workers', async () => {
  const { createSealRecovery } =
    await import('@/infrastructure/anchor/createSealRecovery');
  const { readAnchorConfig } =
    await import('@/infrastructure/anchor/anchorProviderFactory');
  const f = await fixture();
  const config = expectSuccess(readAnchorConfig({ NODE_ENV: 'test' }));
  const restarted = () => createSealRecovery(db.prisma, config);
  const completed = expectSuccess(await restarted().nudge(f.command.pollId));
  expect(completed).toBe('submitted');
  const saved = await db.prisma.pollSeal.findUniqueOrThrow({
    where: { pollId: f.command.pollId },
  });
  expect(saved.rootDigest).toHaveLength(64);
  expect(expectSuccess(await restarted().nudge(f.command.pollId))).toBe('idle');

  const orphan = await fixture();
  expectSuccess(await orphan.useCase.execute(orphan.command));
  expect(expectSuccess(await restarted().nudge(orphan.command.pollId))).toBe(
    'submitted'
  );
  await db.pool.query(
    "UPDATE seal_anchors SET next_attempt_at=submitted_at+interval '1 millisecond' WHERE poll_id=$1",
    [orphan.command.pollId]
  );
  expect(expectSuccess(await restarted().nudge(orphan.command.pollId))).toBe(
    'busy'
  );
  const tick = expectSuccess(await restarted().execute());
  expect(tick.pending).toBeGreaterThanOrEqual(1);
  expect(
    await db.prisma.sealAnchor.count({
      where: { pollId: orphan.command.pollId },
    })
  ).toBe(1);
});
