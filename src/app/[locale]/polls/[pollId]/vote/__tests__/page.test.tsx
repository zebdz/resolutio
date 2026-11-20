/** Revisiting a completed ballot recovers private cast evidence without resubmission. */
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  vote: vi.fn(),
  receipt: vi.fn(),
  panel: vi.fn(),
}));
vi.mock('@/src/web/actions/poll/vote', () => ({
  canUserVoteAction: mocks.vote,
  getMyVoteReceiptAction: mocks.receipt,
}));
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: async () => ({ id: 'voter' }),
}));
vi.mock('@/infrastructure/index', () => ({ prisma: {} }));
vi.mock('@/src/web/components/polls/voting/VotingInterface', () => ({
  default: vi.fn(),
}));
vi.mock('@/web/components/seal/VoteReceiptPanel', () => ({
  VoteReceiptPanel: mocks.panel,
}));
vi.mock('@/src/web/components/polls/PublicOpenPollPreview', () => ({
  PublicOpenPollPreview: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/src/web/components/layout/AuthenticatedLayout', () => ({
  AuthenticatedLayout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/src/i18n/routing', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
import Page from '../page';

it.each(['alreadyVoted', 'pollFinished'])(
  'reopens the voter’s saved receipt after %s',
  async (reasonCode) => {
    mocks.vote.mockResolvedValue({
      success: true,
      data: { canVote: false, reasonCode },
    });
    const view = { kind: 'legacy' } as const;
    mocks.receipt.mockResolvedValue({ success: true, data: view });
    mocks.panel.mockReturnValue(<div>My vote receipt</div>);
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ pollId: 'poll', locale: 'en' }) })
    );
    expect(html).toContain('My vote receipt');
    expect(mocks.receipt).toHaveBeenCalledWith('poll');
    expect(mocks.panel.mock.lastCall?.[0]).toEqual({ view });
  }
);
