import 'dotenv/config';
import { PrismaClient, PollState } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

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

// Dummy members added to the test org so it passes the `min_org_size` gate
// (default 3). Idempotent: matched by phone number.
const DUMMY_MEMBERS = [
  {
    phoneNumber: '+79160000091',
    nickname: 'legal_test_member_1',
    firstName: 'Анна',
    lastName: 'Петрова',
    middleName: 'Ивановна',
  },
  {
    phoneNumber: '+79160000092',
    nickname: 'legal_test_member_2',
    firstName: 'Сергей',
    lastName: 'Соколов',
    middleName: 'Михайлович',
  },
  {
    phoneNumber: '+79160000093',
    nickname: 'legal_test_member_3',
    firstName: 'Елена',
    lastName: 'Новикова',
    middleName: 'Андреевна',
  },
];
const DUMMY_PASSWORD = 'password123';

/**
 * Seeds a test organization + 5 polls with varying legality levels for
 * manual testing of the AI legal-check feature.
 *
 * Run: npx tsx prisma/seed-legal-check.ts
 *   or with a specific superadmin phone:
 *      npx tsx prisma/seed-legal-check.ts +79160000000
 *
 * Idempotent: can be re-run safely; existing org/polls are reused.
 * The resolved superadmin is added as both a member and an admin of
 * the test org.
 */

const ORG_NAME = 'AI Legal Check Test Org';
const ORG_DESCRIPTION =
  'Test organization containing polls that exercise the AI legality-check validation: clean, warning-level, and clearly illegal content.';

interface SeedPoll {
  title: string;
  description: string;
  expected: 'clean' | 'warning' | 'danger';
  questions: {
    text: string;
    details?: string;
    answers: string[];
  }[];
}

const POLLS: SeedPoll[] = [
  {
    title: 'Дата весеннего субботника',
    description:
      'Выбираем удобную дату для совместной уборки территории. Чистый поллинг без правовых нюансов.',
    expected: 'clean',
    questions: [
      {
        text: 'Какую дату вы предпочитаете для весеннего субботника?',
        answers: ['15 апреля', '22 апреля', '29 апреля'],
      },
      {
        text: 'Принесёте ли вы свой инвентарь?',
        answers: ['Да', 'Нет, нужно выдать'],
      },
    ],
  },
  {
    title: 'Формат ежемесячных собраний',
    description:
      'Согласуем формат и время следующих собраний совета организации.',
    expected: 'clean',
    questions: [
      {
        text: 'В каком формате проводить ежемесячные собрания?',
        answers: ['Очно', 'Онлайн (видеосвязь)', 'Гибридный формат'],
      },
      {
        text: 'Удобное время для начала собрания?',
        answers: ['10:00', '14:00', '19:00'],
      },
    ],
  },
  {
    title: 'Публикация контактов членов организации',
    description:
      'Обсуждаем, какие персональные данные членов организации можно публиковать на нашем общедоступном сайте.',
    expected: 'warning',
    questions: [
      {
        text: 'Согласны ли вы с публикацией полного списка ФИО, домашних адресов и телефонов всех членов организации на нашем общедоступном сайте?',
        details:
          'Цель публикации — прозрачность перед местным сообществом. Данные будут видны всем посетителям сайта без авторизации.',
        answers: [
          'Да, публиковать полный список в открытом доступе',
          'Публиковать только ФИО',
          'Отказываюсь, только для членов организации',
        ],
      },
    ],
  },
  {
    title: 'Акция протеста против застройщика',
    description:
      'Обсуждаем форму коллективного протеста против местного застройщика, нарушающего, по нашему мнению, права жителей.',
    expected: 'danger',
    questions: [
      {
        text: 'Предлагаем провести стихийный митинг 5 мая у здания администрации БЕЗ подачи уведомления органам власти. Поддерживаете ли вы такое решение?',
        details:
          'Митинг планируется на 200+ человек в рабочий день, в центральной части города.',
        answers: [
          'Да, поддерживаю несанкционированную акцию',
          'Только при подаче уведомления согласно 54-ФЗ',
          'Против проведения любых массовых акций',
        ],
      },
    ],
  },
  {
    title: 'Ограничение приёма новых членов',
    description:
      'Обсуждается вопрос о возможных критериях отбора новых членов организации.',
    expected: 'danger',
    questions: [
      {
        text: 'Следует ли ограничить приём новых членов организации на основании их национальной принадлежности, чтобы сохранить культурную однородность коллектива?',
        answers: [
          'Да, ограничить приём по национальному признаку',
          'Нет, приём должен быть равным для всех',
        ],
      },
      {
        text: 'Следует ли также отказывать в приёме людям старше 60 лет, считая их менее активными участниками?',
        answers: [
          'Да, ввести возрастной ценз',
          'Нет, возраст не является критерием',
        ],
      },
    ],
  },
];

async function resolveSuperadmin(
  phoneArg: string | undefined
): Promise<{ id: string; name: string; phone: string }> {
  if (phoneArg) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneArg },
    });

    if (!user) {
      throw new Error(`No user found with phone ${phoneArg}`);
    }

    const sa = await prisma.superAdmin.findUnique({
      where: { userId: user.id },
    });

    if (!sa) {
      throw new Error(
        `User ${phoneArg} exists but is not a superadmin. Run: yarn db:superadmin:add ${phoneArg}`
      );
    }

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phoneNumber,
    };
  }

  const sa = await prisma.superAdmin.findFirst({ include: { user: true } });

  if (!sa) {
    throw new Error(
      'No superadmin found in the database. Create one with: yarn db:superadmin:add <phone>'
    );
  }

  return {
    id: sa.userId,
    name: `${sa.user.firstName} ${sa.user.lastName}`.trim(),
    phone: sa.user.phoneNumber,
  };
}

async function upsertOrg(createdById: string): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { name: ORG_NAME },
  });

  if (existing) {
    console.log(`Reusing existing org: ${existing.id}`);

    return existing.id;
  }

  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      description: ORG_DESCRIPTION,
      createdById,
    },
  });
  console.log(`Created org: ${org.id}`);

  return org.id;
}

async function ensureDummyMembers(
  organizationId: string,
  invitedBy: string
): Promise<void> {
  for (const m of DUMMY_MEMBERS) {
    let user = await prisma.user.findUnique({
      where: { phoneNumber: m.phoneNumber },
    });

    if (!user) {
      const pw = await hash(DUMMY_PASSWORD, ARGON2_OPTIONS);
      user = await prisma.user.create({
        data: {
          firstName: m.firstName,
          lastName: m.lastName,
          middleName: m.middleName,
          phoneNumber: m.phoneNumber,
          nickname: m.nickname,
          password: pw,
          language: 'ru',
          consentGivenAt: new Date(),
        },
      });
      console.log(
        `  + Created user: ${m.firstName} ${m.lastName} (${m.phoneNumber})`
      );
    } else {
      console.log(`  = Reusing user: ${m.firstName} ${m.lastName}`);
    }

    const existing = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (!existing) {
      await prisma.organizationUser.create({
        data: {
          organizationId,
          userId: user.id,
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedByUserId: invitedBy,
        },
      });
      console.log(`      Added membership row`);
    } else if (existing.status !== 'accepted') {
      await prisma.organizationUser.update({
        where: { id: existing.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedByUserId: invitedBy,
        },
      });
      console.log(`      Upgraded membership to accepted`);
    } else {
      console.log(`      Membership already accepted`);
    }
  }
}

async function ensureMembership(
  organizationId: string,
  userId: string
): Promise<void> {
  // Member row (accepted)
  const existingMember = await prisma.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!existingMember) {
    await prisma.organizationUser.create({
      data: {
        organizationId,
        userId,
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    });
    console.log('  Added member row');
  } else if (existingMember.status !== 'accepted') {
    await prisma.organizationUser.update({
      where: { id: existingMember.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    });
    console.log('  Upgraded member row to accepted');
  } else {
    console.log('  Member row already accepted');
  }

  // Admin row
  const existingAdmin = await prisma.organizationAdminUser.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!existingAdmin) {
    await prisma.organizationAdminUser.create({
      data: { organizationId, userId },
    });
    console.log('  Added admin row');
  } else {
    console.log('  Admin row already present');
  }
}

async function createPollIfMissing(
  organizationId: string,
  createdBy: string,
  poll: SeedPoll
): Promise<'created' | 'skipped'> {
  const existing = await prisma.poll.findFirst({
    where: { organizationId, title: poll.title },
  });

  if (existing) {
    return 'skipped';
  }

  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.poll.create({
    data: {
      organizationId,
      createdBy,
      title: poll.title,
      description: poll.description,
      startDate,
      endDate,
      state: PollState.READY,
      questions: {
        create: poll.questions.map((q, qi) => ({
          text: q.text,
          details: q.details ?? null,
          page: 1,
          order: qi,
          questionType: 'single-choice',
          answers: {
            create: q.answers.map((a, ai) => ({ text: a, order: ai })),
          },
        })),
      },
    },
  });

  return 'created';
}

async function main() {
  const phoneArg = process.argv[2];

  console.log('\n=== Seeding AI Legal Check test data ===\n');

  const superadmin = await resolveSuperadmin(phoneArg);
  console.log(
    `Superadmin: ${superadmin.name} (${superadmin.phone}) — id=${superadmin.id}`
  );

  const orgId = await upsertOrg(superadmin.id);

  console.log('\nEnsuring superadmin membership...');
  await ensureMembership(orgId, superadmin.id);

  console.log('\nSeeding dummy members (to pass min_org_size gate)...');
  await ensureDummyMembers(orgId, superadmin.id);

  console.log('\nSeeding polls...');
  let created = 0;
  let skipped = 0;

  for (const poll of POLLS) {
    const status = await createPollIfMissing(orgId, superadmin.id, poll);
    const marker =
      poll.expected === 'danger'
        ? '[DANGER] '
        : poll.expected === 'warning'
          ? '[WARN]   '
          : '[CLEAN]  ';
    console.log(`  ${marker}${status === 'created' ? '+' : '='} ${poll.title}`);

    if (status === 'created') {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `\nDone. Created ${created} poll(s), skipped ${skipped} existing.`
  );
  console.log(`\nOpen: /polls then select "${ORG_NAME}" as the organization.`);
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
