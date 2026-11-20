/** Signed-out verification exposes commitments only. Private records stay behind authorized downloads. */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { success } from '@/domain/shared/Result';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';

const mocks = vi.hoisted(() => ({
  publicRecord: vi.fn(),
  user: vi.fn(),
  permissions: vi.fn(),
  after: vi.fn(),
  nudge: vi.fn(),
}));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/infrastructure/repositories/PrismaSealSummaries', () => ({
  readPublicSeal: mocks.publicRecord,
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/infrastructure/database/prisma', () => ({ prisma: {} }));
vi.mock('@/infrastructure/repositories/PrismaSealPermissions', () => ({
  PrismaSealPermissions: class {
    forViewer = mocks.permissions;
  },
}));
vi.mock('@/infrastructure/anchor/createSealRecovery', () => ({
  createSealRecovery: () => ({ nudge: mocks.nudge }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ dateTime: () => '' }),
}));
vi.mock('@/src/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const { default: Page } = await import('../page');
const record = {
  manifest: fixture.record.manifest,
  rootDigest: fixture.record.rootDigest,
  proofAvailable: true,
  status: { kind: 'pending' },
};
const params = Promise.resolve({ pollId: 'poll1', locale: 'en' });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.publicRecord.mockResolvedValue(success(record));
  mocks.user.mockResolvedValue(null);
  mocks.nudge.mockResolvedValue(success('idle'));
});

it('displays five commitments, independent commands and public downloads without requesting private records', async () => {
  const html = renderToStaticMarkup(await Page({ params }));
  const manifest = JSON.parse(record.manifest);

  for (const section of Object.values(manifest.sections) as {
    root?: string;
    hash?: string;
  }[]) {
    expect(html).toContain(section.hash ?? section.root);
  }

  expect(html).toContain(record.rootDigest);
  expect(html).toContain('/api/polls/poll1/seal/manifest');
  expect(html).toContain('href="/en/polls/poll1/verify-my-vote"');
  expect(html).toContain('/api/polls/poll1/seal/proof');
  expect(html).toContain('ots --no-cache verify -f manifest.json ./poll1.ots');
  expect(html).not.toContain('/api/polls/poll1/seal/sections');
  expect(html).not.toContain(fixture.input.poll.title);
  expect(html).not.toContain(JSON.parse(fixture.receipt).receiptSecret);
  expect(mocks.permissions).not.toHaveBeenCalled();
  expect(mocks.after).not.toHaveBeenCalled();
  expect(mocks.user).not.toHaveBeenCalled();
});

it('shows the verified block and UTC instant and leaves confirmed anchors alone', async () => {
  const time = '2026-09-12T11:14:23.000Z';
  mocks.publicRecord.mockResolvedValue(
    success({ ...record, status: { kind: 'bitcoin', height: 900000, time } })
  );
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html).toContain('https://blockchair.com/bitcoin/block/900000');
  expect(html).toContain('dateTime="' + time + '"');
  expect(mocks.after).not.toHaveBeenCalled();
});

it('never resolves a signed-in viewer or schedules private recovery during the public render', async () => {
  mocks.user.mockResolvedValue({ id: 'PRIVATE_USER', email: 'PRIVATE_EMAIL' });
  const html = renderToStaticMarkup(await Page({ params }));
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.permissions).not.toHaveBeenCalled();
  expect(mocks.after).not.toHaveBeenCalled();
  expect(html).not.toContain('PRIVATE_USER');
  expect(html).not.toContain('PRIVATE_EMAIL');
});

it('omits the timestamp download until proof bytes exist', async () => {
  mocks.publicRecord.mockResolvedValue(
    success({
      ...record,
      status: { kind: 'failed', provider: 'opentimestamps' },
      proofAvailable: false,
    })
  );
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html).not.toContain('/seal/proof');
  expect(html).toContain('proofUnavailable');
});

it('leaves unpublished poll details private without resolving private recovery rows', async () => {
  mocks.publicRecord.mockResolvedValue({
    success: false,
    error: 'seal.errors.notFound',
  });
  const html = renderToStaticMarkup(await Page({ params }));
  expect(html).toContain('missing');
  expect(html).not.toContain('poll1');
  expect(mocks.after).not.toHaveBeenCalled();
});
