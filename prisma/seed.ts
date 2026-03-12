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

// ── Seeded PRNG for reproducible data ──────────────────────────
let _seed = 42;

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

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, Math.min(n, copy.length));
}

function daysAgo(d: number): Date {
  const date = new Date('2026-03-03');
  date.setDate(date.getDate() - d);

  return date;
}

function daysFromNow(d: number): Date {
  const date = new Date('2026-03-03');
  date.setDate(date.getDate() + d);

  return date;
}

// ── Name pools ─────────────────────────────────────────────────
const FIRST_NAMES = [
  'Алексей',
  'Мария',
  'Дмитрий',
  'Елена',
  'Николай',
  'Ольга',
  'Игорь',
  'Анна',
  'Сергей',
  'Наталья',
  'Виктор',
  'Татьяна',
  'Андрей',
  'Светлана',
  'Павел',
  'Ирина',
  'Михаил',
  'Екатерина',
  'Владимир',
  'Юлия',
  'Артём',
  'Валентина',
  'Роман',
  'Людмила',
  'Константин',
  'Марина',
  'Евгений',
  'Оксана',
  'Денис',
  'Галина',
  'Максим',
  'Вера',
  'Александр',
  'Надежда',
  'Иван',
  'Любовь',
  'Кирилл',
  'Тамара',
  'Олег',
  'Лариса',
];
const LAST_NAMES = [
  'Иванов',
  'Петров',
  'Сидоров',
  'Кузнецов',
  'Козлов',
  'Новиков',
  'Волков',
  'Морозов',
  'Лебедев',
  'Соколов',
  'Попов',
  'Васильев',
  'Павлов',
  'Семёнов',
  'Голубев',
  'Виноградов',
  'Богданов',
  'Воробьёв',
  'Фёдоров',
  'Михайлов',
  'Беляев',
  'Тарасов',
  'Белов',
  'Комаров',
  'Орлов',
  'Киселёв',
  'Макаров',
  'Андреев',
  'Ковалёв',
  'Ильин',
  'Гусев',
  'Титов',
  'Кузьмин',
  'Кудрявцев',
  'Баранов',
  'Куликов',
  'Алексеев',
  'Степанов',
  'Яковлев',
  'Сорокин',
];
const MIDDLE_NAMES: (string | null)[] = [
  'Петрович',
  'Сергеевич',
  'Андреевич',
  'Дмитриевич',
  'Викторович',
  'Александрович',
  'Николаевич',
  'Михайлович',
  'Иванович',
  'Владимирович',
  'Олегович',
  'Евгеньевич',
  'Алексеевич',
  'Павлович',
  'Романович',
  null,
  null,
  null,
  null,
  null, // ~25% no middle name
];

// ── Org templates ──────────────────────────────────────────────
const ORG_TYPES = [
  'ТСЖ',
  'СНТ',
  'Дачный кооператив',
  'Гаражный кооператив',
  'Профсоюз',
  'Спортивный клуб',
  'Жилищный кооператив',
  'Садовое товарищество',
  'Кооператив',
  'Объединение жителей',
];
const ORG_SUFFIXES = [
  'Солнечный',
  'Берёзка',
  'Рассвет',
  'Дубрава',
  'Прогресс',
  'Олимп',
  'Единство',
  'Надежда',
  'Радуга',
  'Восход',
  'Лесной',
  'Озёрный',
  'Полянка',
  'Мечта',
  'Звёздный',
  'Уютный дом',
  'Гармония',
  'Факел',
  'Искра',
  'Заря',
  'Орион',
  'Парус',
  'Горизонт',
  'Юпитер',
  'Кедр',
  'Сосна',
  'Липа',
  'Рябина',
  'Клён',
  'Тополь',
  'Ясень',
  'Победа',
  'Северный',
  'Южный',
  'Западный',
  'Восточный',
  'Центральный',
  'Молодёжный',
  'Ветеран',
  'Сатурн',
  'Нептун',
];
const CHILD_PREFIXES = [
  'Подъезд',
  'Корпус',
  'Секция',
  'Блок',
  'Сектор',
  'Участок',
  'Дом',
  'Квартал',
  'Зона',
  'Крыло',
];

// ── Poll templates ─────────────────────────────────────────────
const POLL_TOPICS = [
  {
    t: 'Утверждение бюджета',
    q: 'Утверждаете ли вы бюджет?',
    a: ['Да', 'Нет', 'Воздерживаюсь'],
  },
  { t: 'Ремонт кровли', q: 'Поддерживаете ли вы ремонт?', a: ['Да', 'Нет'] },
  {
    t: 'Замена лифта',
    q: 'Одобряете ли вы замену?',
    a: ['Да', 'Нет', 'Нужно обсудить'],
  },
  { t: 'Установка шлагбаума', q: 'Установить шлагбаум?', a: ['Да', 'Нет'] },
  {
    t: 'Строительство забора',
    q: 'Согласны на строительство?',
    a: ['Да', 'Нет', 'Частично'],
  },
  {
    t: 'Выбор управляющей компании',
    q: 'Какую УК выбрать?',
    a: ['УК Комфорт', 'УК Домовой', 'УК Надёжный'],
  },
  {
    t: 'Детская площадка',
    q: 'Какой тип площадки?',
    a: ['Деревянная', 'Металлическая', 'Комбинированная'],
  },
  {
    t: 'Благоустройство двора',
    q: 'Поддерживаете благоустройство?',
    a: ['Да', 'Нет'],
  },
  {
    t: 'Видеонаблюдение',
    q: 'Установить камеры?',
    a: ['Да', 'Нет', 'Только на входе'],
  },
  { t: 'Субботник', q: 'Участвуете в субботнике?', a: ['Да', 'Нет'] },
  { t: 'Замена труб', q: 'Одобряете замену?', a: ['Да', 'Нет', 'Частично'] },
  { t: 'Коллективный договор', q: 'Утверждаете договор?', a: ['Да', 'Нет'] },
  {
    t: 'Бурение скважины',
    q: 'Согласны на долевое участие?',
    a: ['Да', 'Нет', 'Нужна скидка'],
  },
  {
    t: 'Спортивный турнир',
    q: 'Формат турнира?',
    a: ['Один день', 'Два дня', 'Неделя'],
  },
  {
    t: 'Покраска фасада',
    q: 'Какой цвет?',
    a: ['Бежевый', 'Серый', 'Голубой', 'Оставить'],
  },
  { t: 'Парковочные места', q: 'Поддерживаете организацию?', a: ['Да', 'Нет'] },
  { t: 'Установка домофона', q: 'Установить домофон?', a: ['Да', 'Нет'] },
  {
    t: 'Ремонт подъезда',
    q: 'Какой ремонт?',
    a: ['Косметический', 'Капитальный', 'Не нужен'],
  },
  {
    t: 'Озеленение территории',
    q: 'Поддерживаете озеленение?',
    a: ['Да', 'Нет'],
  },
  {
    t: 'Ремонт дороги',
    q: 'Одобряете ремонт дороги?',
    a: ['Да', 'Нет', 'Частично'],
  },
];

const NOTIF_TYPES = [
  'pollActivated',
  'pollFinished',
  'joinRequestReceived',
  'joinRequestAccepted',
  'joinRequestRejected',
];
const NOTIF_TITLES: Record<string, string> = {
  pollActivated: 'Голосование началось',
  pollFinished: 'Голосование завершено',
  joinRequestReceived: 'Новый запрос на вступление',
  joinRequestAccepted: 'Запрос одобрен',
  joinRequestRejected: 'Запрос отклонён',
};

const BOARD_NAMES = [
  'Президиум',
  'Орг комитет',
  'Финансовый комитет',
  'Ревизионная комиссия',
  'Совет дома',
];

// ════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log('Seeding database (50x scale)...\n');

  // ── Clean ────────────────────────────────────────────────────
  await prisma.voteDraft.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.participantWeightHistory.deleteMany();
  await prisma.pollParticipant.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.boardUser.deleteMany();
  await prisma.board.deleteMany();
  await prisma.organizationAdminUser.deleteMany();
  await prisma.organizationUser.deleteMany();
  await prisma.organizationJoinParentRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.superAdmin.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  console.log('Cleaned existing data');

  // ── 1. Users (600) ──────────────────────────────────────────
  const pw = await hash('password123', ARGON2_OPTIONS);
  console.log('Password hashed');

  const usersInput = Array.from({ length: 600 }, (_, i) => ({
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName:
      LAST_NAMES[i % LAST_NAMES.length] +
      (i >= 40 ? `-${Math.floor(i / 40) + 1}` : ''),
    middleName: MIDDLE_NAMES[i % MIDDLE_NAMES.length],
    phoneNumber: `+7916${String(1000001 + i)}`,
    password: pw,
    language: i % 10 === 0 ? ('en' as const) : ('ru' as const),
    consentGivenAt: new Date('2026-03-03'),
    nickname: `user_${String(i).padStart(4, '0')}`,
  }));

  await prisma.user.createMany({ data: usersInput });
  const users = await prisma.user.findMany({ orderBy: { phoneNumber: 'asc' } });
  console.log(`Users: ${users.length}`);

  await prisma.superAdmin.create({ data: { userId: users[0].id } });

  // ── 2. Organizations (~400) ─────────────────────────────────
  // 80 roots: first 50 get children, last 30 standalone
  const usedOrgNames = new Set<string>();

  function orgName(type: string, idx: number): string {
    const suffix = ORG_SUFFIXES[idx % ORG_SUFFIXES.length];
    let name = `${type} "${suffix}"`;

    if (usedOrgNames.has(name)) {
      name = `${type} "${suffix}-${idx}"`;
    }

    usedOrgNames.add(name);

    return name;
  }

  type Org = { id: string; parentId: string | null };
  const roots: Org[] = [];
  const children: Org[] = [];
  const hierarchies: { root: Org; children: Org[] }[] = [];

  for (let i = 0; i < 80; i++) {
    const type = ORG_TYPES[i % ORG_TYPES.length];
    const name = orgName(type, i);
    const archived = rand() < 0.05 ? daysAgo(randInt(30, 365)) : null;
    const org = await prisma.organization.create({
      data: {
        name,
        description: `${name} — описание`,
        createdById: users[i % users.length].id,
        archivedAt: archived,
      },
    });
    roots.push({ id: org.id, parentId: null });
  }

  // Children for first 50 roots
  for (let i = 0; i < 50; i++) {
    const root = roots[i];
    const nChildren = randInt(2, 6);
    const kids: Org[] = [];

    for (let c = 0; c < nChildren; c++) {
      const prefix = CHILD_PREFIXES[c % CHILD_PREFIXES.length];
      const name = `${prefix} ${c + 1} — R${i + 1}`;

      if (usedOrgNames.has(name)) {
        continue;
      }

      usedOrgNames.add(name);
      const org = await prisma.organization.create({
        data: {
          name,
          description: `${name} — подразделение`,
          createdById: users[(i * 7 + c + 80) % users.length].id,
          parentId: root.id,
        },
      });
      children.push({ id: org.id, parentId: root.id });
      kids.push({ id: org.id, parentId: root.id });
    }

    hierarchies.push({ root, children: kids });
  }

  for (let i = 50; i < 80; i++) {
    hierarchies.push({ root: roots[i], children: [] });
  }

  const allOrgs = [...roots, ...children];
  console.log(
    `Orgs: ${allOrgs.length} (${roots.length} roots, ${children.length} children)`
  );

  // ── 3. Admins + Members ─────────────────────────────────────
  // Respect hierarchy: no user in both root and child of same tree
  const adminRows: { organizationId: string; userId: string }[] = [];
  const memberRows: {
    organizationId: string;
    userId: string;
    status: string;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
    rejectionReason?: string | null;
    rejectedByUserId?: string | null;
  }[] = [];
  const orgMembers = new Map<string, string[]>(); // orgId → accepted user IDs

  const memberDedup = new Set<string>();
  const adminDedup = new Set<string>();

  for (const h of hierarchies) {
    const poolSize = randInt(15, 40);
    const pool = pickN(users, poolSize);
    const rootCount = randInt(5, 15);
    const rootUsers = pool.slice(0, rootCount);
    const childPool = pool.slice(rootCount);

    const rootUserIds = new Set(rootUsers.map((u) => u.id));

    // Root admin
    const rootAdmin = rootUsers[0];
    const ak = `${h.root.id}:${rootAdmin.id}`;

    if (!adminDedup.has(ak)) {
      adminDedup.add(ak);
      adminRows.push({ organizationId: h.root.id, userId: rootAdmin.id });
    }

    // Root members
    const rootAccepted: string[] = [];

    for (const u of rootUsers) {
      const mk = `${h.root.id}:${u.id}`;

      if (memberDedup.has(mk)) {
        continue;
      }

      memberDedup.add(mk);
      const pending = rand() < 0.05;
      const rejected = !pending && rand() < 0.03;
      memberRows.push({
        organizationId: h.root.id,
        userId: u.id,
        status: pending ? 'pending' : rejected ? 'rejected' : 'accepted',
        acceptedAt: !pending && !rejected ? daysAgo(randInt(10, 365)) : null,
        rejectedAt: rejected ? daysAgo(randInt(5, 30)) : null,
        rejectionReason: rejected ? 'Не подтверждена принадлежность' : null,
        rejectedByUserId: rejected ? rootAdmin.id : null,
      });

      if (!pending && !rejected) {
        rootAccepted.push(u.id);
      }
    }

    orgMembers.set(h.root.id, rootAccepted);

    // Children members (no overlap with root)
    const perChild = Math.max(
      3,
      Math.floor(childPool.length / Math.max(h.children.length, 1))
    );

    for (let ci = 0; ci < h.children.length; ci++) {
      const child = h.children[ci];
      const slice = childPool.slice(ci * perChild, (ci + 1) * perChild);

      if (slice.length === 0) {
        continue;
      }

      const childAdmin = slice[0];
      const cak = `${child.id}:${childAdmin.id}`;

      if (!adminDedup.has(cak)) {
        adminDedup.add(cak);
        adminRows.push({ organizationId: child.id, userId: childAdmin.id });
      }

      const childAccepted: string[] = [];

      for (const u of slice) {
        if (rootUserIds.has(u.id)) {
          continue;
        } // hierarchy constraint

        const mk = `${child.id}:${u.id}`;

        if (memberDedup.has(mk)) {
          continue;
        }

        memberDedup.add(mk);
        const pending = rand() < 0.05;
        memberRows.push({
          organizationId: child.id,
          userId: u.id,
          status: pending ? 'pending' : 'accepted',
          acceptedAt: !pending ? daysAgo(randInt(10, 300)) : null,
        });

        if (!pending) {
          childAccepted.push(u.id);
        }
      }

      orgMembers.set(child.id, childAccepted);
    }
  }

  await prisma.organizationAdminUser.createMany({ data: adminRows });

  for (let i = 0; i < memberRows.length; i += 500) {
    await prisma.organizationUser.createMany({
      data: memberRows.slice(i, i + 500),
    });
  }

  console.log(`Admins: ${adminRows.length}, Members: ${memberRows.length}`);

  // ── 4. Boards (~500) ────────────────────────────────────────
  type Board = { id: string; orgId: string };
  const boards: Board[] = [];

  for (const org of allOrgs) {
    const n = randInt(1, 3);

    for (let b = 0; b < n; b++) {
      try {
        const board = await prisma.board.create({
          data: { name: BOARD_NAMES[b], organizationId: org.id },
        });
        boards.push({ id: board.id, orgId: org.id });
      } catch {
        // unique constraint — skip
      }
    }
  }

  console.log(`Boards: ${boards.length}`);

  // ── 5. Board members ────────────────────────────────────────
  const buRows: { boardId: string; userId: string; addedBy: string }[] = [];
  const buDedup = new Set<string>();

  for (const board of boards) {
    const mems = orgMembers.get(board.orgId) ?? [];

    if (mems.length === 0) {
      continue;
    }

    const count = Math.min(mems.length, randInt(2, Math.min(10, mems.length)));
    const selected = pickN(mems, count);
    const adder = selected[0];

    for (const uid of selected) {
      const k = `${board.id}:${uid}`;

      if (buDedup.has(k)) {
        continue;
      }

      buDedup.add(k);
      buRows.push({ boardId: board.id, userId: uid, addedBy: adder });
    }
  }

  for (let i = 0; i < buRows.length; i += 500) {
    await prisma.boardUser.createMany({ data: buRows.slice(i, i + 500) });
  }

  console.log(`Board members: ${buRows.length}`);

  // ── 6. Polls (~450) ─────────────────────────────────────────
  const stateWeights = [
    [PollState.DRAFT, 0.15],
    [PollState.READY, 0.15],
    [PollState.ACTIVE, 0.35],
    [PollState.FINISHED, 0.35],
  ] as const;

  function pickState(): PollState {
    const r = rand();
    let cum = 0;

    for (const [s, w] of stateWeights) {
      cum += w;

      if (r < cum) {
        return s;
      }
    }

    return PollState.ACTIVE;
  }

  function datePair(state: PollState): [Date, Date] {
    switch (state) {
      case PollState.DRAFT:
        return [daysFromNow(randInt(5, 30)), daysFromNow(randInt(31, 60))];
      case PollState.READY:
        return [daysFromNow(randInt(1, 10)), daysFromNow(randInt(11, 25))];
      case PollState.ACTIVE:
        return [daysAgo(randInt(1, 10)), daysFromNow(randInt(1, 20))];
      case PollState.FINISHED:
        return [daysAgo(randInt(30, 180)), daysAgo(randInt(10, 29))];
    }
  }

  let pollCount = 0;
  const pollIds: string[] = [];

  for (const board of boards) {
    const nPolls = randInt(0, 2);
    const mems = orgMembers.get(board.orgId) ?? [];

    if (mems.length < 2) {
      continue;
    }

    const admin = adminRows.find((a) => a.organizationId === board.orgId);
    const createdBy = admin?.userId ?? mems[0];

    for (let p = 0; p < nPolls; p++) {
      const topic = POLL_TOPICS[(pollCount + p) % POLL_TOPICS.length];
      const state = pickState();
      const [startDate, endDate] = datePair(state);

      const poll = await prisma.poll.create({
        data: {
          title: `${topic.t} #${pollCount + 1}`,
          description: `Голосование: ${topic.t}`,
          organizationId: board.orgId,
          boardId: board.id,
          startDate,
          endDate,
          state,
          createdBy,
        },
      });
      pollIds.push(poll.id);

      // Question + answers
      const question = await prisma.question.create({
        data: {
          text: topic.q,
          pollId: poll.id,
          page: 1,
          order: 0,
          questionType: 'single-choice',
        },
      });
      const answers = [];

      for (let a = 0; a < topic.a.length; a++) {
        const ans = await prisma.answer.create({
          data: { text: topic.a[a], questionId: question.id, order: a },
        });
        answers.push(ans);
      }

      // Participants + votes for non-DRAFT
      if (state !== PollState.DRAFT && mems.length >= 2) {
        const pCount = Math.min(
          mems.length,
          randInt(3, Math.min(15, mems.length))
        );
        const participants = pickN(mems, pCount);

        const ppData = participants.map((uid) => ({
          pollId: poll.id,
          userId: uid,
          userWeight: rand() < 0.2 ? 1.5 : 1.0,
          willingToSignProtocol:
            state === PollState.FINISHED ? rand() < 0.7 : undefined,
        }));
        await prisma.pollParticipant.createMany({ data: ppData });

        // Votes for FINISHED
        if (state === PollState.FINISHED) {
          const voteDedup = new Set<string>();
          const voteData: {
            questionId: string;
            answerId: string;
            userId: string;
            userWeight: number;
          }[] = [];

          for (const pp of ppData) {
            const vk = `${question.id}:${pp.userId}`;

            if (voteDedup.has(vk)) {
              continue;
            }

            voteDedup.add(vk);
            voteData.push({
              questionId: question.id,
              answerId: pick(answers).id,
              userId: pp.userId,
              userWeight: pp.userWeight,
            });
          }

          await prisma.vote.createMany({ data: voteData });
        }
      }

      pollCount++;
    }
  }

  console.log(`Polls: ${pollCount}`);

  // ── 7. Notifications (500) ──────────────────────────────────
  const notifData = Array.from({ length: 500 }, (_, i) => {
    const type = pick(NOTIF_TYPES);

    return {
      userId: pick(users).id,
      type,
      title: NOTIF_TITLES[type],
      body: `Уведомление #${i + 1}`,
      data:
        pollIds.length > 0
          ? JSON.stringify({ pollId: pick(pollIds) })
          : undefined,
      readAt: rand() < 0.4 ? daysAgo(randInt(1, 30)) : null,
    };
  });

  for (let i = 0; i < notifData.length; i += 500) {
    await prisma.notification.createMany({
      data: notifData.slice(i, i + 500),
    });
  }

  console.log(`Notifications: ${notifData.length}`);

  // ── 8. Join parent requests (~50) ───────────────────────────
  // Standalone orgs (idx 50-79) requesting to join other roots (idx 0-49)
  let jpCount = 0;
  const jpDedup = new Set<string>();

  for (let i = 0; i < 50; i++) {
    const childIdx = 50 + (i % 30);
    const parentIdx = i % 50;
    const childOrg = roots[childIdx];
    const parentOrg = roots[parentIdx];

    if (!childOrg || !parentOrg) {
      continue;
    }

    const k = `${childOrg.id}:${parentOrg.id}`;

    if (jpDedup.has(k)) {
      continue;
    }

    jpDedup.add(k);

    const admin = adminRows.find((a) => a.organizationId === childOrg.id);

    if (!admin) {
      continue;
    }

    const status =
      rand() < 0.6 ? 'pending' : rand() < 0.5 ? 'accepted' : 'rejected';

    await prisma.organizationJoinParentRequest.create({
      data: {
        childOrgId: childOrg.id,
        parentOrgId: parentOrg.id,
        requestingAdminId: admin.userId,
        message: `Запрос на присоединение #${jpCount + 1}`,
        status,
        rejectionReason:
          status === 'rejected' ? 'Не соответствует критериям' : null,
        handledAt: status !== 'pending' ? daysAgo(randInt(1, 30)) : null,
      },
    });
    jpCount++;
  }

  console.log(`Join parent requests: ${jpCount}`);

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n=== Seed Complete (50x scale) ===');
  console.log(`Users: ${users.length}`);
  console.log(`Orgs: ${allOrgs.length}`);
  console.log(`Boards: ${boards.length}`);
  console.log(`Board members: ${buRows.length}`);
  console.log(`Polls: ${pollCount}`);
  console.log(`Notifications: ${notifData.length}`);
  console.log(`Join parent requests: ${jpCount}`);
  console.log('\nPassword for all users: password123');
  console.log('First user (+79161000001) is superadmin');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
