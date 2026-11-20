/** A named voter's recorded six-place ballot weight must survive the detail view. */
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnswerId, UserId } from '@/domain/shared/EntityIds';
import {
  VoteCount,
  VotingPercentage,
  TotalVotingWeight,
} from '@/domain/poll/ResultTallies';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { TotalWeight } from '@/domain/seal/SealValues';
import VoterBreakdownDialog from '../VoterBreakdownDialog';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/src/web/components/catalyst/dialog', () => {
  const section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Dialog: section,
    DialogActions: section,
    DialogBody: section,
    DialogTitle: section,
  };
});

it('displays the exact aggregate and the voter’s original weight on a sealed result', () => {
  const answer = {
    answerId: AnswerId.parse('a'),
    answerText: 'Approve',
    voteCount: VoteCount.parse(1),
    weightedVotes: TotalVotingWeight.parse(2.125),
    exactWeight: TotalWeight.parse('2.125000'),
    percentage: VotingPercentage.parse(100),
    voters: [
      {
        userId: UserId.parse('u'),
        userName: 'Voter',
        weight: VotingWeight.parse(2.125),
      },
    ],
  };
  const render = (
    entry: Omit<typeof answer, 'exactWeight'> & {
      exactWeight?: typeof answer.exactWeight;
    }
  ) =>
    renderToStaticMarkup(
      <VoterBreakdownDialog isOpen onClose={() => undefined} answer={entry} />
    );
  const html = render(answer);
  expect(html.match(/2\.125/g)?.length).toBe(2);

  expect(
    render({ ...answer, exactWeight: undefined }).match(/2\.13/g)?.length
  ).toBe(2);
});
