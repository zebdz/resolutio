/** The public UI for an authorized results view ties its links and badge to the
 * source of the displayed totals, including live fallback without a digest. */
import { it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultsPageContent } from '../ResultsPageContent';
import { PollState } from '@/domain/poll/PollState';
import { PollId, AnswerId, QuestionId } from '@/domain/shared/EntityIds';
import {
  ParticipantCount,
  TotalVotingWeight,
  VoteCount,
  VotingPercentage,
} from '@/domain/poll/ResultTallies';
import { Digest, TotalWeight } from '@/domain/seal/SealValues';
import type { ResultsPageView } from '../ResultsPageView';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}));
vi.mock('@/src/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/web/components/layout/AppNavbar', () => ({ AppNavbar: () => null }));
vi.mock('@/web/components/layout/MobileSidebar', () => ({
  MobileSidebar: () => null,
}));
vi.mock('@/web/components/catalyst/stacked-layout', () => ({
  StackedLayout: ({ children }: { children: ReactNode }) => children,
}));

const digest = Digest.parse('a'.repeat(64));
const view: ResultsPageView = {
  title: 'Frozen title',
  description: '',
  attachmentIds: [],
  distributionType: 'EQUAL',
  propertyAggregation: 'RAW_SUM',
  scopedPropertyNames: [],
  showAggregation: false,
  buildingTotal: 0,
  pollState: PollState.FINISHED,
  isPollCreator: false,
  isAnonymous: true,
  isOpenPoll: false,
  canViewVoterNames: false,
  canViewSignWillingness: false,
  results: {
    pollId: PollId.parse('poll-1'),
    questions: [],
    protocolSignWillingness: [],
    totalParticipants: ParticipantCount.parse(0),
    votedParticipants: ParticipantCount.parse(0),
    totalWeight: TotalVotingWeight.parse(0),
  },
  coverage: {
    kind: 'sealed',
    seal: { rootDigest: digest, status: { kind: 'pending' } },
    hasOwnVote: false,
  },
  navigation: {
    firstName: 'Viewer',
    isSuperAdmin: false,
    unreadNotificationCount: 0,
  },
  reports: [],
};

it('shows the exact covered digest and offers the personal check only to voters', () => {
  const html = renderToStaticMarkup(<ResultsPageContent view={view} />);
  expect(html).toContain('Frozen title');
  expect(html).toContain(digest);
  expect(html).toContain('/api/polls/poll-1/seal/sections');
  expect(html).not.toContain('/verify-my-vote');
});

it('shows the pending seal without a digest or links to sealed downloads', () => {
  const html = renderToStaticMarkup(
    <ResultsPageContent view={{ ...view, coverage: { kind: 'sealing' } }} />
  );
  expect(html).toContain('sealing');
  expect(html).not.toContain(digest);
  expect(html).not.toContain('/seal/sections');
});

it('uses the exact winning answer and weight when two totals round to the same JS number', () => {
  const large = '9999999999.000001';
  const larger = '9999999999.000002';
  const choices = [large, larger].map((exact, index) => ({
    answerId: AnswerId.parse('answer-' + index),
    answerText: 'choice ' + index,
    weightedVotes: TotalVotingWeight.parse(Number(exact)),
    exactWeight: TotalWeight.parse(exact),
    percentage: VotingPercentage.parse(50),
    voteCount: VoteCount.parse(1),
    voters: [],
  }));
  expect(choices[0].weightedVotes).toBe(choices[1].weightedVotes);
  const html = renderToStaticMarkup(
    <ResultsPageContent
      view={{
        ...view,
        results: {
          ...view.results,
          questions: [
            {
              questionId: QuestionId.parse('q'),
              questionText: 'Who won?',
              questionType: 'single-choice',
              winningAnswerId: choices[1].answerId,
              totalVotes: VoteCount.parse(2),
              participantWeight: TotalVotingWeight.parse(0),
              totalWeight: TotalVotingWeight.parse(0),
              answers: choices,
            },
          ],
        },
      }}
    />
  );
  expect(html).toContain(larger);
  expect(html).toContain('winner');
});
