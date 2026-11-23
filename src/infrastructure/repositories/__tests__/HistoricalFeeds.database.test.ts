/** Exercise the poll and report feeds against migrated PostgreSQL, including
 * optional filters and the membership check shared by the organization page. */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { UserId } from '@/domain/shared/EntityIds';
import { listHistory } from '@/infrastructure/history/history';
import { pollDatabase } from './pollDatabase';

let db: Awaited<ReturnType<typeof pollDatabase>>;
vi.mock('@/infrastructure/database/prisma', () => ({
  get prisma() {
    return db.prisma;
  },
}));

// Next can evaluate the SQL tag in the ESM page bundle while retaining a CJS
// Prisma client across requests. Exercise that combination with both real tags.
vi.mock('@/generated/prisma/client', async (original) => {
  const client = await original<typeof import('@/generated/prisma/client')>();
  const { sql, join } = await import('@prisma/client-runtime-utils');

  return { ...client, Prisma: { ...client.Prisma, sql, join } };
});

beforeAll(async () => {
  db = await pollDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});

it('lists ordinary poll and report feeds with no import installed', async () => {
  const viewer = UserId.parse('reader');
  expect(await listHistory(viewer, 'poll', { search: 'test' })).toEqual([]);
  expect(await listHistory(viewer, 'report')).toEqual([]);
});

it('binds the supplemental feed filters as SQL when the server and page use different Prisma runtimes', async () => {
  await db.pool.query(`
    create view historical_imports as select 'batch'::text id,'feed-org'::text organization_id;
    create view historical_polls as select 'meeting'::text id,'batch'::text batch_id,'proposal'::text kind,
      'March vote'::text title,null::text board_id,null::text native_poll_id,
      '2025-03-01'::timestamp created,'2025-03-02'::timestamp started;
    create function historical_can_poll(viewer text,parent text) returns boolean language sql as
      $$ select viewer='reader' and parent='meeting' $$;
  `);
  const filters = {
    orgIds: ['other-org', 'feed-org'],
    search: 'MARCH',
    status: 'finished',
    boardId: '__org_wide__',
    createdFrom: '2025-03-01',
    startTo: '2025-03-02',
  };
  const viewer = UserId.parse('reader');
  expect(await listHistory(viewer, 'poll', filters)).toEqual([
    { id: 'meeting', title: 'March vote', collection: null },
  ]);
  expect(await listHistory(null, 'poll', filters)).toEqual([]);
  expect(
    await listHistory(viewer, 'poll', { ...filters, startTo: '2025-03-01' })
  ).toEqual([]);
});
