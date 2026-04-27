import 'dotenv/config';
import { PrismaClient, PollState } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'crypto';
import { loadCrossTreeData, printCrossTreeSummary } from './demo-summary';

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
// Usage: yarn db:seed [scale]
// scale=50 (default) → ~600 users, ~80 orgs, ~500 notifs
// scale=500          → ~6k users, ~800 orgs, ~5k notifs
// scale=5000         → ~60k users, ~8k orgs, ~50k notifs
const SCALE = Math.max(1, parseInt(process.argv[2] ?? '50', 10));

async function main() {
  console.log(`Seeding database (scale=${SCALE})...\n`);

  // ── Clean (TRUNCATE CASCADE handles all FK constraints) ─────
  const client = await pool.connect();

  try {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name != '_prisma_migrations'`
    );
    const quoted = rows.map((r) => `"${r.table_name}"`).join(', ');

    if (quoted) {
      await client.query(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
    }
  } finally {
    client.release();
  }

  console.log('Cleaned existing data');

  // ── 1. Users ───────────────────────────────────────────────
  const USER_COUNT = SCALE * 12;
  const pw = await hash('password123', ARGON2_OPTIONS);
  console.log('Password hashed');

  const usersInput = Array.from({ length: USER_COUNT }, (_, i) => ({
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName:
      LAST_NAMES[i % LAST_NAMES.length] +
      (i >= 40 ? `-${Math.floor(i / 40) + 1}` : ''),
    middleName: MIDDLE_NAMES[i % MIDDLE_NAMES.length],
    phoneNumber: `+7916${String(1000001 + i)}`,
    password: pw,
    language: i % 10 === 0 ? ('en' as const) : ('ru' as const),
    consentGivenAt: new Date('2026-03-03'),
    nickname: `user_${String(i).padStart(6, '0')}`,
  }));

  for (let i = 0; i < usersInput.length; i += 1000) {
    await prisma.user.createMany({ data: usersInput.slice(i, i + 1000) });
  }

  const users = await prisma.user.findMany({ orderBy: { phoneNumber: 'asc' } });
  console.log(`Users: ${users.length}`);

  await prisma.superAdmin.create({ data: { userId: users[0].id } });

  // ── 2. Organizations ────────────────────────────────────────
  const ROOT_COUNT = Math.max(4, Math.floor(SCALE * 1.6));
  const ROOTS_WITH_CHILDREN = Math.max(2, Math.floor(ROOT_COUNT * 0.625));
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

  // Pre-generate root orgs
  const rootOrgRows: {
    id: string;
    name: string;
    description: string;
    createdById: string;
    archivedAt: Date | null;
  }[] = [];

  for (let i = 0; i < ROOT_COUNT; i++) {
    const type = ORG_TYPES[i % ORG_TYPES.length];
    const name = orgName(type, i);
    const id = randomUUID();
    rootOrgRows.push({
      id,
      name,
      description: `${name} — описание`,
      createdById: users[i % users.length].id,
      archivedAt: rand() < 0.05 ? daysAgo(randInt(30, 365)) : null,
    });
    roots.push({ id, parentId: null });
  }

  for (let i = 0; i < rootOrgRows.length; i += 1000) {
    await prisma.organization.createMany({
      data: rootOrgRows.slice(i, i + 1000),
    });
  }

  // Pre-generate child orgs
  const childOrgRows: {
    id: string;
    name: string;
    description: string;
    createdById: string;
    parentId: string;
  }[] = [];

  for (let i = 0; i < ROOTS_WITH_CHILDREN; i++) {
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
      const id = randomUUID();
      childOrgRows.push({
        id,
        name,
        description: `${name} — подразделение`,
        createdById: users[(i * 7 + c + 80) % users.length].id,
        parentId: root.id,
      });
      children.push({ id, parentId: root.id });
      kids.push({ id, parentId: root.id });
    }

    hierarchies.push({ root, children: kids });
  }

  for (let i = 0; i < childOrgRows.length; i += 1000) {
    await prisma.organization.createMany({
      data: childOrgRows.slice(i, i + 1000),
    });
  }

  for (let i = ROOTS_WITH_CHILDREN; i < ROOT_COUNT; i++) {
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
    const poolSize = randInt(
      15,
      Math.min(80, Math.max(20, Math.floor(SCALE * 0.8)))
    );
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
      const pending = rand() < 0.12;
      const rejected = !pending && rand() < 0.04;
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

  for (let i = 0; i < adminRows.length; i += 1000) {
    await prisma.organizationAdminUser.createMany({
      data: adminRows.slice(i, i + 1000),
    });
  }

  for (let i = 0; i < memberRows.length; i += 500) {
    await prisma.organizationUser.createMany({
      data: memberRows.slice(i, i + 500),
    });
  }

  console.log(`Admins: ${adminRows.length}, Members: ${memberRows.length}`);

  // ── 4. Boards (1-3 per org) — batched ───────────────────────
  type Board = { id: string; orgId: string };
  const boards: Board[] = [];
  const boardRows: { id: string; name: string; organizationId: string }[] = [];
  const boardDedup = new Set<string>();

  for (const org of allOrgs) {
    const n = randInt(1, 3);

    for (let b = 0; b < n; b++) {
      const k = `${org.id}:${BOARD_NAMES[b]}`;

      if (boardDedup.has(k)) {
        continue;
      }

      boardDedup.add(k);
      const id = randomUUID();
      boardRows.push({ id, name: BOARD_NAMES[b], organizationId: org.id });
      boards.push({ id, orgId: org.id });
    }
  }

  for (let i = 0; i < boardRows.length; i += 1000) {
    await prisma.board.createMany({ data: boardRows.slice(i, i + 1000) });
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

  // ── 6. Polls (0-2 per board) — batched ──────────────────────
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

  // Build admin lookup for O(1) access
  const adminByOrg = new Map<string, string>();

  for (const a of adminRows) {
    if (!adminByOrg.has(a.organizationId)) {
      adminByOrg.set(a.organizationId, a.userId);
    }
  }

  // Pre-generate all data in memory
  const pollRows: {
    id: string;
    title: string;
    description: string;
    organizationId: string;
    boardId: string;
    startDate: Date;
    endDate: Date;
    state: PollState;
    createdBy: string;
  }[] = [];
  const questionRows: {
    id: string;
    text: string;
    pollId: string;
    page: number;
    order: number;
    questionType: string;
  }[] = [];
  const answerRows: {
    id: string;
    text: string;
    questionId: string;
    order: number;
  }[] = [];
  const ppRows: {
    pollId: string;
    userId: string;
    userWeight: number;
    willingToSignProtocol?: boolean;
  }[] = [];
  const voteRows: {
    questionId: string;
    answerId: string;
    userId: string;
    userWeight: number;
  }[] = [];
  const pollIds: string[] = [];
  let pollCount = 0;

  for (const board of boards) {
    const nPolls = randInt(0, 2);
    const mems = orgMembers.get(board.orgId) ?? [];

    if (mems.length < 2) {
      continue;
    }

    const createdBy = adminByOrg.get(board.orgId) ?? mems[0];

    for (let p = 0; p < nPolls; p++) {
      const topic = POLL_TOPICS[(pollCount + p) % POLL_TOPICS.length];
      const state = pickState();
      const [startDate, endDate] = datePair(state);
      const pollId = randomUUID();
      const questionId = randomUUID();

      pollRows.push({
        id: pollId,
        title: `${topic.t} #${pollCount + 1}`,
        description: `Голосование: ${topic.t}`,
        organizationId: board.orgId,
        boardId: board.id,
        startDate,
        endDate,
        state,
        createdBy,
      });
      pollIds.push(pollId);

      questionRows.push({
        id: questionId,
        text: topic.q,
        pollId,
        page: 1,
        order: 0,
        questionType: 'single-choice',
      });

      const ansIds: string[] = [];

      for (let a = 0; a < topic.a.length; a++) {
        const ansId = randomUUID();
        ansIds.push(ansId);
        answerRows.push({
          id: ansId,
          text: topic.a[a],
          questionId,
          order: a,
        });
      }

      // Participants + votes for non-DRAFT
      if (state !== PollState.DRAFT && mems.length >= 2) {
        const pCount = Math.min(
          mems.length,
          randInt(3, Math.min(15, mems.length))
        );
        const participants = pickN(mems, pCount);
        const voteDedup = new Set<string>();

        for (const uid of participants) {
          const weight = rand() < 0.2 ? 1.5 : 1.0;
          ppRows.push({
            pollId,
            userId: uid,
            userWeight: weight,
            willingToSignProtocol:
              state === PollState.FINISHED ? rand() < 0.7 : undefined,
          });

          if (state === PollState.FINISHED) {
            const vk = `${questionId}:${uid}`;

            if (!voteDedup.has(vk)) {
              voteDedup.add(vk);
              voteRows.push({
                questionId,
                answerId: ansIds[Math.floor(rand() * ansIds.length)],
                userId: uid,
                userWeight: weight,
              });
            }
          }
        }
      }

      pollCount++;
    }
  }

  // Batch insert all poll data
  for (let i = 0; i < pollRows.length; i += 1000) {
    await prisma.poll.createMany({ data: pollRows.slice(i, i + 1000) });
  }

  for (let i = 0; i < questionRows.length; i += 1000) {
    await prisma.question.createMany({
      data: questionRows.slice(i, i + 1000),
    });
  }

  for (let i = 0; i < answerRows.length; i += 1000) {
    await prisma.answer.createMany({ data: answerRows.slice(i, i + 1000) });
  }

  for (let i = 0; i < ppRows.length; i += 1000) {
    await prisma.pollParticipant.createMany({
      data: ppRows.slice(i, i + 1000),
    });
  }

  for (let i = 0; i < voteRows.length; i += 1000) {
    await prisma.vote.createMany({ data: voteRows.slice(i, i + 1000) });
  }

  console.log(
    `Polls: ${pollCount}, Questions: ${questionRows.length}, Answers: ${answerRows.length}, Participants: ${ppRows.length}, Votes: ${voteRows.length}`
  );

  // ── 7. Notifications ────────────────────────────────────────
  const NOTIF_COUNT = SCALE * 10;
  const notifData = Array.from({ length: NOTIF_COUNT }, (_, i) => {
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

  // ── 8. Join parent requests — batched ────────────────────────
  const STANDALONE_COUNT = ROOT_COUNT - ROOTS_WITH_CHILDREN;
  const JP_ITERATIONS = ROOTS_WITH_CHILDREN;
  const jpRows: {
    childOrgId: string;
    parentOrgId: string;
    requestingAdminId: string;
    message: string;
    status: string;
    rejectionReason: string | null;
    handledAt: Date | null;
  }[] = [];
  const jpDedup = new Set<string>();

  for (let i = 0; i < JP_ITERATIONS; i++) {
    const childIdx = ROOTS_WITH_CHILDREN + (i % STANDALONE_COUNT);
    const parentIdx = i % ROOTS_WITH_CHILDREN;
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

    const admin = adminByOrg.get(childOrg.id);

    if (!admin) {
      continue;
    }

    const status =
      rand() < 0.6 ? 'pending' : rand() < 0.5 ? 'accepted' : 'rejected';

    jpRows.push({
      childOrgId: childOrg.id,
      parentOrgId: parentOrg.id,
      requestingAdminId: admin,
      message: `Запрос на присоединение #${jpRows.length + 1}`,
      status,
      rejectionReason:
        status === 'rejected' ? 'Не соответствует критериям' : null,
      handledAt: status !== 'pending' ? daysAgo(randInt(1, 30)) : null,
    });
  }

  for (let i = 0; i < jpRows.length; i += 1000) {
    await prisma.organizationJoinParentRequest.createMany({
      data: jpRows.slice(i, i + 1000),
    });
  }

  console.log(`Join parent requests: ${jpRows.length}`);

  // ── 9. Condo ownership (roots[0]) ───────────────────────────
  await seedCondoOwnership(
    prisma,
    roots[0].id,
    orgMembers.get(roots[0].id) ?? []
  );

  // ── 10. Cross-tree ownership demo ────────────────────────────
  await seedCrossTreeOwnership(
    prisma,
    await hash('password123', ARGON2_OPTIONS)
  );

  // ── Summary ──────────────────────────────────────────────────
  console.log(`\n=== Seed Complete (scale=${SCALE}) ===`);
  console.log(`Users: ${users.length}`);
  console.log(`Orgs: ${allOrgs.length}`);
  console.log(`Boards: ${boards.length}`);
  console.log(`Board members: ${buRows.length}`);
  console.log(`Polls: ${pollCount}`);
  console.log(`Notifications: ${notifData.length}`);
  console.log(`Join parent requests: ${jpRows.length}`);
  console.log('\nPassword for all users: password123');
  console.log('First user (+79161000001) is superadmin');
}

async function seedCondoOwnership(
  prismaClient: PrismaClient,
  orgId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) {
    console.log('[seed] skipping condo ownership — no users');

    return;
  }

  // Idempotency guard
  const existing = await prismaClient.organizationProperty.findFirst({
    where: { organizationId: orgId, name: 'Apt house #13' },
  });

  if (existing) {
    console.log('[seed] condo ownership already present, skipping');

    return;
  }

  // Property 1: Apartment house — 10 apts summing to 850 m²
  const aptHouse = await prismaClient.organizationProperty.create({
    data: {
      organizationId: orgId,
      name: 'Apt house #13',
      address: '5th St.',
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const aptSizes = [75, 100, 80, 80, 80, 85, 85, 85, 90, 90];
  const apts: { id: string }[] = [];

  for (let i = 0; i < aptSizes.length; i++) {
    apts.push(
      await prismaClient.propertyAsset.create({
        data: {
          propertyId: aptHouse.id,
          name: `Apt #${101 + i}`,
          size: aptSizes[i],
        },
      })
    );
  }

  // Property 2: Parking lot — 20 spots of 12 m² each
  const parkingLot = await prismaClient.organizationProperty.create({
    data: {
      organizationId: orgId,
      name: 'Parking lot',
      address: '5th St.',
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const spots: { id: string }[] = [];

  for (let i = 0; i < 20; i++) {
    spots.push(
      await prismaClient.propertyAsset.create({
        data: {
          propertyId: parkingLot.id,
          name: `Parking #${i + 1}`,
          size: 12,
        },
      })
    );
  }

  // Ownership:
  // - user 0: owns apt #101 fully + parking #1 fully
  // - user 1: owns 50% of apt #102 + parking #2 fully + 50% of parking #3
  // - users 2..9: one apt each (#103..#110)
  await prismaClient.propertyAssetOwnership.create({
    data: { assetId: apts[0].id, userId: userIds[0], share: 1 },
  });
  await prismaClient.propertyAssetOwnership.create({
    data: { assetId: spots[0].id, userId: userIds[0], share: 1 },
  });

  if (userIds.length >= 2) {
    await prismaClient.propertyAssetOwnership.create({
      data: { assetId: apts[1].id, userId: userIds[1], share: 0.5 },
    });
    await prismaClient.propertyAssetOwnership.create({
      data: { assetId: spots[1].id, userId: userIds[1], share: 1 },
    });
    await prismaClient.propertyAssetOwnership.create({
      data: { assetId: spots[2].id, userId: userIds[1], share: 0.5 },
    });
  }

  for (let i = 2; i < Math.min(userIds.length, 10); i++) {
    await prismaClient.propertyAssetOwnership.create({
      data: { assetId: apts[i].id, userId: userIds[i], share: 1 },
    });
  }

  console.log(
    `[seed] condo ownership: ${apts.length} apts + ${spots.length} parking spots for ${Math.min(userIds.length, 10)} users`
  );
}

// ── Cross-tree ownership demo scenario ─────────────────────────
//
// Builds a deterministic scenario that exercises every cross-tree concern:
//  - a parent org "Tree Root A" with no properties of its own
//  - two child orgs "Building B" and "Parking C"
//  - multi-tree membership: Oscar is a member of A, B, AND C
//  - cross-asset co-ownership inside B (Alice + Bob share an apt)
//  - mixed unit properties (m² apartments vs m² parking — same unit here for
//    simplicity; the logic that matters is the per-property denominator)
//
// At the end we print a summary table with:
//  - who owns what (user → org → property → asset → share)
//  - expected weights for 5 representative poll configurations
//
// The expected weights are computed by re-running the domain `computeWeights`
// function over the same inputs the app would hand it — so the table is
// literally "what you will see when these users vote".
async function seedCrossTreeOwnership(
  client: PrismaClient,
  passwordHash: string
): Promise<void> {
  // Idempotency guard — matches the pattern used by seedCondoOwnership.
  const existing = await client.organization.findFirst({
    where: { name: 'Tree Root A (demo)' },
  });

  if (existing) {
    console.log('[seed] cross-tree demo already present, skipping');

    return;
  }

  // Users — named, with distinct +79162*** phone prefix so they don't collide
  // with the randomly-generated users earlier in the seed.
  const userSpecs = [
    { phone: '+79162000001', firstName: 'Alice', lastName: 'Anderson' },
    { phone: '+79162000002', firstName: 'Bob', lastName: 'Brown' },
    { phone: '+79162000003', firstName: 'Helen', lastName: 'Harris' },
    { phone: '+79162000004', firstName: 'Oscar', lastName: 'Osborne' },
  ];

  const users = await Promise.all(
    userSpecs.map((s, i) =>
      client.user.create({
        data: {
          firstName: s.firstName,
          lastName: s.lastName,
          middleName: null,
          phoneNumber: s.phone,
          password: passwordHash,
          nickname: s.firstName.toLowerCase() + '_demo',
          language: 'en',
          confirmedAt: new Date(),
          consentGivenAt: new Date(),
          privacySetupCompleted: true,
          allowFindByPhone: true,
          createdAt: new Date(`2026-02-${String(i + 1).padStart(2, '0')}`),
        },
      })
    )
  );
  const [alice, bob, helen, oscar] = users;

  // Orgs: A (root) → B, C.
  // allowMultiTreeMembership on A so Oscar can join both B and C under A.
  const orgA = await client.organization.create({
    data: {
      name: 'Tree Root A (demo)',
      description:
        'Parent org with no properties — exists for cross-tree polls.',
      createdById: oscar.id,
      allowMultiTreeMembership: true,
    },
  });
  const orgB = await client.organization.create({
    data: {
      name: 'Building B (demo)',
      description: 'Apartment building — 4 apts.',
      createdById: alice.id,
      parentId: orgA.id,
    },
  });
  const orgC = await client.organization.create({
    data: {
      name: 'Parking C (demo)',
      description: 'Parking lot — 5 spots.',
      createdById: helen.id,
      parentId: orgA.id,
    },
  });

  // Memberships: Alice → B; Bob → B; Helen → C; Oscar → A + B + C (multi-tree).
  const memberships = [
    { userId: alice.id, orgId: orgB.id },
    { userId: bob.id, orgId: orgB.id },
    { userId: helen.id, orgId: orgC.id },
    { userId: oscar.id, orgId: orgA.id },
    { userId: oscar.id, orgId: orgB.id },
    { userId: oscar.id, orgId: orgC.id },
  ];
  await client.organizationUser.createMany({
    data: memberships.map((m) => ({
      userId: m.userId,
      organizationId: m.orgId,
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedByUserId: oscar.id,
    })),
  });
  // Each org also needs its creator as an admin.
  await client.organizationAdminUser.createMany({
    data: [
      { userId: oscar.id, organizationId: orgA.id },
      { userId: alice.id, organizationId: orgB.id },
      { userId: helen.id, organizationId: orgC.id },
    ],
  });

  // Properties + assets. B has 4 apts (total 290 m²); C has 5 spots (total 60 m²).
  const aptProperty = await client.organizationProperty.create({
    data: {
      organizationId: orgB.id,
      name: 'Apt House (B)',
      address: 'Demo Street 1',
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const aptSpecs = [
    { name: 'B-Apt #1', size: 50 },
    { name: 'B-Apt #2', size: 60 },
    { name: 'B-Apt #3', size: 80 },
    { name: 'B-Apt #4', size: 100 },
  ];
  const apts = await Promise.all(
    aptSpecs.map((s) =>
      client.propertyAsset.create({
        data: { propertyId: aptProperty.id, name: s.name, size: s.size },
      })
    )
  );

  const parkingProperty = await client.organizationProperty.create({
    data: {
      organizationId: orgC.id,
      name: 'Parking (C)',
      address: 'Demo Street 2',
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const spots = await Promise.all(
    [1, 2, 3, 4, 5].map((i) =>
      client.propertyAsset.create({
        data: {
          propertyId: parkingProperty.id,
          name: `C-Spot #${i}`,
          size: 12,
        },
      })
    )
  );

  // Ownership rows. Each asset's active rows sum to 1.0 (enforced).
  const ownershipSpecs = [
    { assetIdx: 0, userId: alice.id, share: 1.0, prop: 'apt' }, // Alice owns B-Apt #1
    { assetIdx: 1, userId: bob.id, share: 1.0, prop: 'apt' }, // Bob owns B-Apt #2
    { assetIdx: 2, userId: alice.id, share: 0.5, prop: 'apt' }, // Alice + Bob co-own #3
    { assetIdx: 2, userId: bob.id, share: 0.5, prop: 'apt' },
    { assetIdx: 3, userId: oscar.id, share: 1.0, prop: 'apt' }, // Oscar owns B-Apt #4
    { assetIdx: 0, userId: helen.id, share: 1.0, prop: 'spot' }, // Helen owns C-Spot #1
    { assetIdx: 1, userId: helen.id, share: 1.0, prop: 'spot' },
    { assetIdx: 2, userId: helen.id, share: 1.0, prop: 'spot' },
    { assetIdx: 3, userId: oscar.id, share: 1.0, prop: 'spot' }, // Oscar owns #4 + #5
    { assetIdx: 4, userId: oscar.id, share: 1.0, prop: 'spot' },
  ];

  for (const spec of ownershipSpecs) {
    const asset =
      spec.prop === 'apt' ? apts[spec.assetIdx] : spots[spec.assetIdx];
    await client.propertyAssetOwnership.create({
      data: { assetId: asset.id, userId: spec.userId, share: spec.share },
    });
  }

  // ── Summary table — re-read from DB via the shared printer so seed-time
  // output and `yarn db:demo-summary` output are generated by the same code.
  const summaryData = await loadCrossTreeData(client);

  if (summaryData) {
    printCrossTreeSummary(summaryData);
  }
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
