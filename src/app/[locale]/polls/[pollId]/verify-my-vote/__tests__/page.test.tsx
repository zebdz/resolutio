/** Keep database promises out of the RSC render. Next development Flight diagnostics
 * can serialize awaited SQL rows even when final component props omit them. */
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), loader: vi.fn() }));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.session }));
vi.mock('@/web/components/seal/VoterEvidenceLoader', () => ({
  VoterEvidenceLoader: mocks.loader,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('@/src/i18n/routing', () => ({
  usePathname: () => '/polls/poll1/verify-my-vote',
  Link: (props: React.ComponentProps<'a'>) => <a {...props} />,
}));
import Page from '../page';

it('renders a session-independent shell and sends only the poll ID to its client', async () => {
  mocks.loader.mockReturnValue(<div>checking access</div>);
  const html = renderToStaticMarkup(
    await Page({ params: Promise.resolve({ pollId: 'poll1', locale: 'en' }) })
  );
  expect(mocks.session).not.toHaveBeenCalled();
  expect(html).toMatch(/<header\b[^>]*>[\s\S]*?<nav\b/);
  expect(html).toContain('checking access');
  expect(mocks.loader.mock.calls[0][0]).toEqual({ pollId: 'poll1' });
});
