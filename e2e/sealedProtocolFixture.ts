/** Build a weighted named or anonymous poll in a disposable database, seal it with the
 * application transaction, then change the live metadata that final protocols must ignore. */
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client';
import { SealPollUseCase } from '@/application/seal/SealPollUseCase';
import {
  SealLeaseSeconds,
  SealWorkOwner,
} from '@/application/seal/SealWorkRepository';
import { PollId } from '@/domain/seal/SealValues';
import { PrismaSealWorkRepository } from '@/infrastructure/repositories/PrismaSealWorkRepository';
import { PrismaSealingTransaction } from '@/infrastructure/repositories/PrismaSealingTransaction';

export async function sealedProtocolFixture(
  db: PrismaClient,
  anonymous: boolean
) {
  const key = randomUUID().slice(0, 8);
  const now = Date.now();
  const phone = '+1555' + randomInt(100000, 999999);
  const password = 'synthetic-password-' + key;
  const account = (name: string, suffix: string) =>
    db.user.create({
      data: {
        firstName: name,
        lastName: 'Example',
        phoneNumber: phone + suffix,
        password,
        nickname: name + key,
        confirmedAt: new Date(),
        privacySetupCompleted: true,
        language: 'en',
        sessions: {
          create: { id: randomUUID(), expiresAt: new Date(now + 3600000) },
        },
      },
      include: { sessions: true },
    });
  const admin = await account('Manager', '1');
  const member = await account('Reader', '2');
  const willing = await account('Marina', '3');
  const declining = await account('Boris', '4');
  const undecided = await account('Sofia', '5');
  const org = await db.organization.create({
    data: {
      name: 'First Assembly ' + key,
      description: 'Fixture',
      createdById: admin.id,
    },
  });
  await db.organizationUser.createMany({
    data: [admin, member, willing, declining, undecided].map((u) => ({
      userId: u.id,
      organizationId: org.id,
      status: 'accepted',
    })),
  });
  await db.organizationAdminUser.create({
    data: { userId: admin.id, organizationId: org.id },
  });
  const board = await db.board.create({
    data: { organizationId: org.id, name: 'First Board' },
  });
  const property = await db.organizationProperty.create({
    data: {
      name: 'East Wing',
      organizationId: org.id,
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const asset = await db.propertyAsset.create({
    data: {
      propertyId: property.id,
      name: 'Unit Olive',
      size: 12.5,
      ownerships: {
        create: {
          userId: willing.id,
          share: 0.5,
          effectiveFrom: new Date(now - 48 * 3600000),
        },
      },
    },
  });
  const receiptSecret = randomBytes(32).toString('hex');
  const participants = [
    {
      userId: willing.id,
      userWeight: 2.125,
      willingToSignProtocol: true,
      receiptSecret,
    },
    {
      userId: declining.id,
      userWeight: 1,
      willingToSignProtocol: false,
      receiptSecret: randomBytes(32).toString('hex'),
    },
    {
      userId: undecided.id,
      userWeight: 1,
      willingToSignProtocol: null,
      receiptSecret: randomBytes(32).toString('hex'),
    },
  ];
  const title = 'Roof repairs ' + key;
  const poll = await db.poll.create({
    data: {
      title,
      description: 'Original description',
      state: 'ACTIVE',
      anonymous,
      createdBy: admin.id,
      organizationId: org.id,
      boardId: board.id,
      startDate: new Date(now - 3600000),
      endDate: new Date(now + 3600000),
      distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      properties: { create: { propertyId: property.id } },
      questions: {
        create: {
          text: 'Approve repairs?',
          answers: { create: { text: 'Approve repairs' } },
        },
      },
      participants: { create: participants },
    },
    include: { questions: { include: { answers: true } } },
  });
  const question = poll.questions[0];
  const answer = question.answers[0];
  await db.vote.createMany({
    data: participants.map((p) => ({
      userId: p.userId,
      userWeight: p.userWeight,
      questionId: question.id,
      answerId: answer.id,
    })),
  });
  await db.poll.update({
    where: { id: poll.id },
    data: { state: 'FINISHED', finishedAt: new Date() },
  });
  const sealer = new SealPollUseCase(
    new PrismaSealWorkRepository(db),
    new PrismaSealingTransaction(db)
  );
  const sealed = await sealer.execute({
    pollId: PollId.parse(poll.id),
    owner: SealWorkOwner.parse(randomUUID()),
    lease: SealLeaseSeconds.parse(60),
  });

  if (!sealed.success || sealed.value.status !== 'sealed') {
    throw new Error('Could not seal test poll: ' + JSON.stringify(sealed));
  }

  const currentTitle = 'Changed title ' + key;
  await db.$transaction([
    db.poll.update({
      where: { id: poll.id },
      data: { title: currentTitle, description: 'Changed description' },
    }),
    db.question.update({
      where: { id: question.id },
      data: { text: 'Changed question' },
    }),
    db.answer.update({
      where: { id: answer.id },
      data: { text: 'Changed answer' },
    }),
    db.organization.update({
      where: { id: org.id },
      data: { name: 'Changed Assembly ' + key },
    }),
    db.board.update({
      where: { id: board.id },
      data: { name: 'Changed Board' },
    }),
    db.user.update({
      where: { id: willing.id },
      data: { firstName: 'Renamed', phoneNumber: phone + '9' },
    }),
    db.pollParticipant.update({
      where: { pollId_userId: { pollId: poll.id, userId: willing.id } },
      data: { willingToSignProtocol: false },
    }),
    db.organizationProperty.update({
      where: { id: property.id },
      data: { name: 'Changed Wing' },
    }),
    db.propertyAsset.update({
      where: { id: asset.id },
      data: { name: 'Changed Unit', size: 99 },
    }),
  ]);

  return {
    poll,
    org,
    admin,
    member,
    willing,
    declining,
    undecided,
    title,
    currentTitle,
    receiptSecret,
    password,
    root: sealed.value.seal.rootDigest,
  };
}
