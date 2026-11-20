/** Private results must never enter the React Server Component render,
 * including development diagnostics that can serialize intermediate database reads. */
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const session = vi.hoisted(() => vi.fn());
vi.mock('@/web/lib/session', () => ({ getCurrentUser: session }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/web/components/polls/results/ResultsPageLoader', () => ({
  ResultsPageLoader: ({ pollId }: { pollId: string }) => (
    <p>Loading {pollId}</p>
  ),
}));
import Page from '../page';

it('renders a poll ID without resolving the viewer or any private records in Flight', async () => {
  const shell = await Page({
    params: Promise.resolve({ pollId: 'poll-1', locale: 'en' }),
  });
  expect(session).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(shell)).toContain('Loading poll-1');
});
