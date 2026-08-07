import 'dotenv/config';
import { PrismaClient, PollState } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { computeWeights } from '../src/domain/poll/WeightDistribution';
import { DistributionType } from '../src/domain/poll/DistributionType';
import { PropertyAggregation } from '../src/domain/poll/PropertyAggregation';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

/**
 * Seeds a RUNNING, property-based, NAMED poll big enough to exercise the
 * named protocol: many voters, many of them already voted, and many owners
 * holding several flats (including co-owned ones, so the "доля X%" suffix
 * appears in the register).
 *
 * Run: npx tsx prisma/seed-named-protocol.ts
 *   or targeting a specific account:
 *      npx tsx prisma/seed-named-protocol.ts +79160000000
 *
 * With no argument it attaches to whoever holds the most recent live session
 * — i.e. the account you are logged in as right now — and makes them an org
 * admin so the poll shows up under /polls immediately.
 *
 * Idempotent: re-running wipes and rebuilds only this org's poll data.
 */

const ORG_NAME = 'ТСЖ «Гвардейский 13» (демо поимённого протокола)';
const ORG_DESCRIPTION =
  'Демо-организация для проверки поимённого протокола: собственность, доли, идущее голосование.';

const POLL_TITLE = 'Утверждение сметы и порядка уведомлений на 2026 год';
const POLL_DESCRIPTION =
  'Очередное общее собрание собственников помещений. Голосование идёт — протокол выгружается как предварительный.';

const MEMBER_COUNT = 80;
// Share of participants who have already cast their votes. The rest stay in
// the "Не голосовали" block of the named protocol.
const VOTED_RATIO = 0.72;
const DEMO_PASSWORD = 'password123';

// ── Seeded PRNG so re-runs produce the same data ───────────────
let _seed = 20260807;

function rand(): number {
  _seed = (_seed * 16807) % 2147483647;

  return (_seed - 1) / 2147483646;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const LAST_NAMES = [
  'Иванов',
  'Петров',
  'Сидоров',
  'Кузнецов',
  'Волков',
  'Соколов',
  'Морозов',
  'Лебедев',
  'Новиков',
  'Козлов',
  'Орлов',
  'Макаров',
  'Никитин',
  'Захаров',
  'Беляев',
  'Тарасов',
  'Белов',
  'Комаров',
  'Щербаков',
  'Киселёв',
  'Гусев',
];
const MALE_NAMES = [
  ['Иван', 'Иванович'],
  ['Пётр', 'Сергеевич'],
  ['Дмитрий', 'Александрович'],
  ['Сергей', 'Николаевич'],
  ['Алексей', 'Петрович'],
  ['Андрей', 'Владимирович'],
  ['Михаил', 'Юрьевич'],
];
const FEMALE_NAMES = [
  ['Анна', 'Ивановна'],
  ['Елена', 'Сергеевна'],
  ['Мария', 'Андреевна'],
  ['Ольга', 'Петровна'],
  ['Наталья', 'Викторовна'],
  ['Татьяна', 'Дмитриевна'],
  ['Ирина', 'Алексеевна'],
];

interface SeedQuestion {
  text: string;
  details: string | null;
  questionType: 'single-choice' | 'multiple-choice';
  answers: string[];
}

const QUESTIONS: SeedQuestion[] = [
  {
    text: 'Утвердить смету расходов на содержание общего имущества на 2026 год',
    details: 'Смета приложена к уведомлению о проведении собрания',
    questionType: 'single-choice',
    answers: ['За', 'Против', 'Воздержался'],
  },
  {
    text: 'Утвердить размер взноса на текущий ремонт — 18,50 ₽ за кв. м в месяц',
    details: null,
    questionType: 'single-choice',
    answers: ['За', 'Против', 'Воздержался'],
  },
  {
    text: 'Выбрать способы уведомления собственников о решениях собрания',
    details: 'Можно выбрать несколько вариантов',
    questionType: 'multiple-choice',
    answers: [
      'Доска объявлений в подъезде',
      'Электронная почта',
      'Мессенджер (Telegram)',
      'Заказное письмо',
    ],
  },
];

async function resolveTargetUser(phoneArg: string | undefined) {
  if (phoneArg) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneArg },
    });

    if (!user) {
      throw new Error(`No user with phone ${phoneArg}`);
    }

    return user;
  }

  // No phone given: attach to whoever is logged in right now. A live session
  // is the only reliable signal we have for "the person running this".
  const session = await prisma.session.findFirst({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  if (!session) {
    throw new Error(
      'No active session found — log in first, or pass a phone number as an argument.'
    );
  }

  return session.user;
}

async function main() {
  const phoneArg = process.argv[2];
  const target = await resolveTargetUser(phoneArg);

  console.log(
    `Attaching to: ${target.lastName} ${target.firstName} (${target.phoneNumber})`
  );

  // ── Organization ──────────────────────────────────────────────
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAME } });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        description: ORG_DESCRIPTION,
        createdById: target.id,
      },
    });
    console.log(`Created organization ${org.id}`);
  } else {
    console.log(`Reusing organization ${org.id}`);
  }

  // Wipe this org's previous demo poll so re-runs stay clean. Only touches
  // rows belonging to this seeded org.
  const oldPolls = await prisma.poll.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });

  if (oldPolls.length > 0) {
    await prisma.poll.deleteMany({
      where: { id: { in: oldPolls.map((p) => p.id) } },
    });
    console.log(`Removed ${oldPolls.length} previous demo poll(s)`);
  }

  await prisma.organizationProperty.deleteMany({
    where: { organizationId: org.id },
  });

  // ── Members ───────────────────────────────────────────────────
  const password = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);
  const memberIds: string[] = [target.id];

  for (let i = 0; i < MEMBER_COUNT; i++) {
    const isFemale = i % 2 === 1;
    const [firstName, patronymic] = pick(isFemale ? FEMALE_NAMES : MALE_NAMES);
    const lastName = pick(LAST_NAMES) + (isFemale ? 'а' : '');
    const phoneNumber = `+7916100${String(1000 + i).padStart(4, '0')}`;
    const nickname = `np_demo_${i}`;

    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: {},
      create: {
        firstName,
        middleName: patronymic,
        lastName,
        phoneNumber,
        nickname,
        password,
        language: 'ru',
        confirmedAt: new Date(),
        consentGivenAt: new Date(),
        privacySetupCompleted: true,
      },
    });

    memberIds.push(user.id);
  }

  for (const userId of memberIds) {
    await prisma.organizationUser.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      update: { status: 'accepted', acceptedAt: new Date() },
      create: {
        organizationId: org.id,
        userId,
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
  }

  // The person running the seeder needs admin rights to compare the member
  // view against the admin view (sign-willingness, phone numbers).
  await prisma.organizationAdminUser.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: target.id },
    },
    update: {},
    create: { organizationId: org.id, userId: target.id },
  });

  console.log(`Members: ${memberIds.length} (target is an org admin)`);

  // ── Properties and assets ─────────────────────────────────────
  // Deliberately more flats than owners — that surplus is what lets a large
  // share of the register hold several properties each.
  const buildings = [
    {
      name: 'Дом Гвардейский 13',
      address: 'ул. Гвардейская, д. 13',
      flats: 120,
    },
    {
      name: 'Дом Гвардейский 15',
      address: 'ул. Гвардейская, д. 15',
      flats: 90,
    },
  ];

  const assets: Array<{ id: string; propertyId: string; size: number }> = [];

  for (const b of buildings) {
    const property = await prisma.organizationProperty.create({
      data: {
        organizationId: org.id,
        name: b.name,
        address: b.address,
        sizeUnit: 'SQUARE_METERS',
      },
    });

    for (let n = 1; n <= b.flats; n++) {
      const size = randInt(28, 96) + Math.round(rand() * 10) / 10;
      const asset = await prisma.propertyAsset.create({
        data: {
          propertyId: property.id,
          name: `кв. ${n}`,
          size,
        },
      });

      assets.push({ id: asset.id, propertyId: property.id, size });
    }
  }

  console.log(
    `Properties: ${buildings.length}, assets: ${assets.length} flats`
  );

  // ── Ownership ─────────────────────────────────────────────────
  // Deliberately lumpy: roughly half the owners hold more than one flat, and
  // some flats are co-owned so the register shows a "доля" suffix.
  const ownerships: Array<{ assetId: string; userId: string; share: number }> =
    [];
  const shuffledAssets = [...assets].sort(() => rand() - 0.5);
  let cursor = 0;

  // Every member gets at least one flat, so nobody ends up with weight 0 and
  // silently dropped from the participant list.
  for (const userId of memberIds) {
    if (cursor >= shuffledAssets.length) {
      break;
    }

    ownerships.push({ assetId: shuffledAssets[cursor].id, userId, share: 1 });
    cursor += 1;
  }

  // Second, third and fourth flats for most of the owners.
  for (const userId of memberIds) {
    if (rand() > 0.7) {
      continue;
    }

    const extra = randInt(1, 3);

    for (let k = 0; k < extra && cursor < shuffledAssets.length; k++) {
      ownerships.push({ assetId: shuffledAssets[cursor].id, userId, share: 1 });
      cursor += 1;
    }
  }

  // Anything left over becomes co-owned between two members.
  while (cursor < shuffledAssets.length) {
    const a = pick(memberIds);
    let b = pick(memberIds);

    while (b === a) {
      b = pick(memberIds);
    }

    ownerships.push({
      assetId: shuffledAssets[cursor].id,
      userId: a,
      share: 0.5,
    });
    ownerships.push({
      assetId: shuffledAssets[cursor].id,
      userId: b,
      share: 0.5,
    });
    cursor += 1;
  }

  // A handful of thirds, so the share formatting sees a non-round number.
  for (let i = 0; i < 4; i++) {
    const asset = pick(assets);
    const existing = ownerships.filter((o) => o.assetId === asset.id);

    if (existing.length !== 1) {
      continue;
    }

    existing[0].share = 0.6667;
    const other = pick(memberIds.filter((m) => m !== existing[0].userId));
    ownerships.push({ assetId: asset.id, userId: other, share: 0.3333 });
  }

  await prisma.propertyAssetOwnership.createMany({
    data: ownerships.map((o) => ({
      assetId: o.assetId,
      userId: o.userId,
      share: o.share,
      effectiveFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    })),
  });

  const multiOwners = new Set(
    memberIds.filter(
      (id) => ownerships.filter((o) => o.userId === id).length > 1
    )
  );

  console.log(
    `Ownership rows: ${ownerships.length}; owners holding 2+ flats: ${multiOwners.size}`
  );

  // ── Poll ──────────────────────────────────────────────────────
  const now = new Date();
  const poll = await prisma.poll.create({
    data: {
      title: POLL_TITLE,
      description: POLL_DESCRIPTION,
      organizationId: org.id,
      boardId: null,
      pollType: 'ORGANIZATION',
      createdBy: target.id,
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      state: PollState.ACTIVE,
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      // The whole point of the demo — a named poll.
      anonymous: false,
    },
  });

  for (const [qi, q] of QUESTIONS.entries()) {
    await prisma.question.create({
      data: {
        pollId: poll.id,
        text: q.text,
        details: q.details,
        questionType: q.questionType,
        page: 1,
        order: qi,
        answers: {
          create: q.answers.map((text, ai) => ({ text, order: ai })),
        },
      },
    });
  }

  const questions = await prisma.question.findMany({
    where: { pollId: poll.id },
    orderBy: { order: 'asc' },
    include: { answers: { orderBy: { order: 'asc' } } },
  });

  // ── Snapshot: weights via the real domain calculation ─────────
  const weights = computeWeights({
    candidates: memberIds,
    distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
    propertyAggregation: PropertyAggregation.RAW_SUM,
    propertyIds: [],
    assets,
    ownerships,
  });

  const snapshotAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.pollEligibleMember.createMany({
    data: memberIds.map((userId) => ({
      pollId: poll.id,
      userId,
      snapshotAt,
    })),
  });

  const participantUserIds = [...weights.keys()];

  await prisma.pollParticipant.createMany({
    data: participantUserIds.map((userId) => ({
      pollId: poll.id,
      userId,
      userWeight: weights.get(userId)!,
      snapshotAt,
    })),
  });

  const participants = await prisma.pollParticipant.findMany({
    where: { pollId: poll.id },
  });

  await prisma.participantWeightHistory.createMany({
    data: participants.map((p) => ({
      participantId: p.id,
      pollId: poll.id,
      userId: p.userId,
      oldWeight: 0,
      newWeight: p.userWeight,
      changedBy: target.id,
      reason: 'Снимок при активации голосования',
      changedAt: snapshotAt,
    })),
  });

  console.log(
    `Participants: ${participants.length}, total weight ${participants
      .reduce((s, p) => s + Number(p.userWeight), 0)
      .toFixed(2)} м²`
  );

  // ── Votes ─────────────────────────────────────────────────────
  // The target account deliberately does NOT vote, so /polls still offers
  // them the "Голосовать" button and the vote-page notice is reachable.
  const canVote = participants.filter((p) => p.userId !== target.id);
  const votersCount = Math.floor(canVote.length * VOTED_RATIO);
  const voters = [...canVote].sort(() => rand() - 0.5).slice(0, votersCount);

  const votes: Array<{
    questionId: string;
    answerId: string;
    userId: string;
    userWeight: number;
  }> = [];

  for (const participant of voters) {
    const weight = Number(participant.userWeight);

    for (const q of questions) {
      if (q.questionType === 'multiple-choice') {
        // 1–3 picks, so the protocol's per-question dedupe is exercised.
        const picks = randInt(1, 3);
        const shuffled = [...q.answers].sort(() => rand() - 0.5);

        for (const answer of shuffled.slice(0, picks)) {
          votes.push({
            questionId: q.id,
            answerId: answer.id,
            userId: participant.userId,
            userWeight: weight,
          });
        }

        continue;
      }

      // Lopsided but not unanimous: a clear winner on both single-choice
      // questions, with real dissent behind it.
      const roll = rand();
      const idx = roll < 0.68 ? 0 : roll < 0.88 ? 1 : 2;

      votes.push({
        questionId: q.id,
        answerId: q.answers[idx].id,
        userId: participant.userId,
        userWeight: weight,
      });
    }
  }

  await prisma.vote.createMany({ data: votes });

  // Sign-willingness is recorded when someone finishes voting.
  for (const participant of voters) {
    await prisma.pollParticipant.update({
      where: { id: participant.id },
      data: { willingToSignProtocol: rand() < 0.75 },
    });
  }

  console.log(
    `Votes: ${votes.length} across ${questions.length} questions from ${voters.length} voters`
  );
  console.log(
    `Not voted yet: ${participants.length - voters.length} (incl. your account)`
  );

  console.log('\nDone.');
  console.log(`  Organization: ${ORG_NAME}`);
  console.log(`  Poll:         ${POLL_TITLE}`);
  console.log(`  State:        ACTIVE, named, OWNERSHIP_SIZE_WEIGHTED`);
  console.log(`  Results:      /ru/polls/${poll.id}/results`);
  console.log(`  Vote page:    /ru/polls/${poll.id}/vote`);
  console.log(`  Demo logins:  +79161001000 … password ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('\nSeed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
