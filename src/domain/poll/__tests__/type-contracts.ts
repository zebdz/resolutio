/** Compile-only clients: swapped meanings and unchecked raw values must fail. */
import {
  BallotSelectionFacts,
  BallotVoterFacts,
  VotingPollFacts,
} from '../BallotPolicy';
import { PollFinished } from '../PollFinished';
import { PollId, PollInstant } from '../PollValues';
import { PollId as SealPollId } from '../../seal/SealValues';

declare const selection: BallotSelectionFacts;
declare const voter: BallotVoterFacts;
declare const poll: VotingPollFacts;
const swapped: BallotSelectionFacts = {
  ...selection,
  // @ts-expect-error Answer IDs cannot substitute for question IDs.
  questionId: selection.answerId,
};
const raw: BallotVoterFacts = {
  ...voter,
  // @ts-expect-error User identifiers must be validated at the boundary.
  userId: 'unvalidated',
};
const unknownState: VotingPollFacts = {
  ...poll,
  // @ts-expect-error Lifecycle states form a closed set.
  state: 'UNKNOWN',
};
const unknownQuestion: VotingPollFacts['questions'][number] = {
  ...poll.questions[0],
  // @ts-expect-error Invalid question types cannot silently behave as multiple choice.
  questionType: 'unknown',
};

declare const pollId: PollId;
declare const instant: PollInstant;
const event: PollFinished = {
  type: 'PollFinished',
  pollId,
  finishedAt: instant,
};
const invalidEvent: PollFinished = {
  ...event,
  // @ts-expect-error Finish instants must be validated.
  finishedAt: 'yesterday',
};
declare const sealPollId: SealPollId;
// @ts-expect-error Context-owned IDs require explicit boundary translation.
const mixedContext: PollId = sealPollId;

import { ParticipantRepository } from '../ParticipantRepository';
import { PollSnapshotTransaction } from '../../../application/poll/PollSnapshotTransaction';
import { success, failure } from '../../shared/Result';
declare const participants: ParticipantRepository;
declare const transaction: PollSnapshotTransaction;
// @ts-expect-error Receipt lookups require decoded owner identifiers.
participants.getCastBallot('raw-poll', 'raw-user');
// @ts-expect-error A voter ID cannot identify a participant row.
participants.castVotes(voter.userId, [], true, null!);
// @ts-expect-error Transaction ports accept validated poll IDs only.
transaction.withLockedPoll('raw-poll', async () => success(undefined));
// @ts-expect-error Business failures must be known domain codes.
transaction.withLockedPoll(pollId, async () => failure('arbitrary message'));

import { BoardId, OrganizationId } from '../../shared/EntityIds';
declare const boardId: BoardId;
// @ts-expect-error A board reference cannot identify an organization.
const wrongOrganization: OrganizationId = boardId;

import { Poll } from '../Poll';
import { PollEligibleMember } from '../PollEligibleMember';
import { PollEligibleMemberId, PropertyId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { VotingWeight } from '../VotingWeight';
import { WeightAsset, WeightOwnership } from '../WeightDistribution';
import { PollWeightConfigProps } from '../PollWeightConfig';
declare const aggregate: Poll;
import { PollTitle, PollDescription } from '../PollContent';
import { PollPeriod } from '../PollPeriod';
import { Instant } from '../../shared/Instant';
// @ts-expect-error Creation requires the validated period, not a mutable Date.
const rawPeriod: Parameters<typeof Poll.create>[5] = new Date();
// @ts-expect-error Poll kinds form a closed set at the aggregate boundary.
const rawKind: Exclude<
  Parameters<typeof Poll.create>[number],
  boolean | undefined
> = 'UNKNOWN';
// @ts-expect-error A lookalike object cannot bypass period ordering validation.
const forgedPeriod: PollPeriod = {
  start: Instant.parse('2026-02-01T00:00:00.000Z'),
  end: Instant.parse('2026-01-01T00:00:00.000Z'),
};
// @ts-expect-error Date edits require a validated period, not unrelated mutable Dates.
aggregate.updateDates(new Date(), new Date());
// @ts-expect-error Poll creation must require validated title content.
const rawPollTitle: Parameters<typeof Poll.create>[0] = 'Unchecked';
// @ts-expect-error A title cannot be used as a poll description.
const wrongPollDescription: Parameters<typeof Poll.create>[1] =
  PollTitle.parse('Title');
// @ts-expect-error Poll title edits cannot accept unchecked text.
aggregate.updateTitle('Unchecked');
// @ts-expect-error Description edits must preserve the description's distinct meaning.
aggregate.updateDescription(PollTitle.parse('Title'));
aggregate.updateTitle(PollTitle.parse('Title'));
aggregate.updateDescription(PollDescription.parse('Description'));
// @ts-expect-error Finish requires an immutable validated poll instant.
aggregate.finish(new Date());
// @ts-expect-error Creator and poll identities are different concepts.
const creatorAsPoll: PollId = aggregate.createdBy;
PollEligibleMember.create(
  pollId,
  voter.userId,
  testCreation(PollEligibleMemberId, 'eligible-1')
);
// @ts-expect-error Eligibility records require explicit identity and time.
PollEligibleMember.create(pollId, voter.userId);
declare const weight: VotingWeight;
declare const asset: WeightAsset;
declare const ownership: WeightOwnership;
const invalidAsset: WeightAsset = {
  ...asset,
  // @ts-expect-error An asset size is not a voting weight.
  size: weight,
};
const invalidOwnership: WeightOwnership = {
  ...ownership,
  // @ts-expect-error A property's identity cannot identify an asset.
  assetId: PropertyId.parse('property-1'),
};
declare const config: PollWeightConfigProps;
const rawScope: PollWeightConfigProps = {
  ...config,
  // @ts-expect-error Scope references require validated property identities.
  propertyIds: ['raw-property'],
};
// @ts-expect-error Aggregate configuration must distinguish distribution from aggregation.
aggregate.applyWeightConfig('RAW_SUM', 'RAW_SUM', []);
// @ts-expect-error Aggregate configuration must distinguish aggregation from distribution.
aggregate.applyWeightConfig('EQUAL', 'EQUAL', []);
// @ts-expect-error Aggregate configuration cannot accept another entity's identity as a property.
aggregate.applyWeightConfig('EQUAL', 'RAW_SUM', [boardId]);
// @ts-expect-error Aggregate property references must already be validated.
aggregate.applyWeightConfig('EQUAL', 'RAW_SUM', ['raw-property']);

import { BuildingWeightTotal } from '../BuildingWeightTotal';
import { PollWeightCalculator } from '../../../application/poll/PollWeightCalculator';
import { PollWeightCalculatorInput } from '../../../application/poll/PollWeightCalculator';
import { Result } from '../../shared/Result';
import { PollWeightCalculationFailure } from '../../../application/poll/PollWeightCalculator';
declare const buildingWeight: BuildingWeightTotal;
declare const calculator: PollWeightCalculator;
declare const calculatorInput: PollWeightCalculatorInput;
// @ts-expect-error A building-wide total is not an individual participant weight.
const buildingAsVoter: VotingWeight = buildingWeight;
const calculatedBuilding: Promise<
  Result<BuildingWeightTotal | null, PollWeightCalculationFailure>
> = calculator.computeBuildingTotal(calculatorInput);
// @ts-expect-error The building total must be explicitly decoded, not supplied as a raw number.
const rawBuildingTotal: BuildingWeightTotal = 3;
