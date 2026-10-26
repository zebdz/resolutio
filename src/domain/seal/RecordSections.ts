/** Deterministic section projections shared by construction and rehydration checks.
 * Counts and weights come from actual votes, with unique-voter participation totals.
 * Calculations retain Weight values; output totals serialize to exact decimal strings. */
import { PollSection, RegisterEntry, TalliesSection } from './RecordFormat';
import { VoteSelection } from './VoteLeaf';
import { QuestionId, AnswerId, PropertyId, AssetId } from './SealValues';
import { compareText } from './Validation';
import { Weight } from './Weight';

export const byOrder = (
  a: { order: number; id: string },
  b: { order: number; id: string }
) => a.order - b.order || compareText(a.id, b.id);
export const byHolding = (
  a: { propertyId: PropertyId; assetId: AssetId },
  b: { propertyId: PropertyId; assetId: AssetId }
) =>
  compareText(a.propertyId, b.propertyId) || compareText(a.assetId, b.assetId);
const sum = (weights: Weight[]) =>
  weights
    .reduce(
      (total, weight) => total.add(weight),
      Weight.fromDecimalString('0.000000')
    )
    .toDecimalString();

export function orderPoll(poll: PollSection): PollSection {
  return {
    ...poll,
    questions: poll.questions
      .map((q) => ({ ...q, answers: [...q.answers].sort(byOrder) }))
      .sort(byOrder),
    propertyIds: [...poll.propertyIds].sort(compareText),
    attachments: [...poll.attachments].sort((a, b) => compareText(a.id, b.id)),
  };
}

export function tally(
  poll: PollSection,
  participants: Pick<RegisterEntry, 'weight'>[],
  votes: readonly VoteSelection[]
): TalliesSection {
  const byQuestion = new Map<QuestionId, VoteSelection[]>();

  for (const vote of votes) {
    const bucket = byQuestion.get(vote.questionId) ?? [];
    bucket.push(vote);
    byQuestion.set(vote.questionId, bucket);
  }

  return {
    totalParticipants: participants.length,
    totalParticipantWeight: sum(participants.map((p) => p.weight)),
    questions: poll.questions
      .filter((q) => q.archivedAt === null)
      .map((q) => {
        const questionVotes = byQuestion.get(q.id) ?? [];
        const byAnswer = new Map<AnswerId, VoteSelection[]>();

        for (const vote of questionVotes) {
          const bucket = byAnswer.get(vote.answerId) ?? [];
          bucket.push(vote);
          byAnswer.set(vote.answerId, bucket);
        }

        const answers = q.answers
          .filter((a) => a.archivedAt === null)
          .map((a) => {
            const selected = byAnswer.get(a.id) ?? [];

            return {
              answerId: a.id,
              voteCount: selected.length,
              totalWeight: sum(selected.map((v) => v.weight)),
            };
          });

        return {
          questionId: q.id,
          answers,
          totalVotes: questionVotes.length,
          totalWeight: sum(questionVotes.map((v) => v.weight)),
          participantWeight: sum([
            ...new Map(questionVotes.map((v) => [v.userId, v.weight])).values(),
          ]),
        };
      }),
  };
}
