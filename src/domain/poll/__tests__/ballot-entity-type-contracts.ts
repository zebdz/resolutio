/** Compile-only ballot entity clients distinguish identities, weights and instants.
 * Creation contexts remove the old empty-ID and implicit-time construction path. */
import { Vote } from '../Vote';
import { VoteDraft } from '../VoteDraft';
import { PollParticipant } from '../PollParticipant';
import { ParticipantWeightHistory } from '../ParticipantWeightHistory';
import { VotingWeight } from '../VotingWeight';
import { VoteRepository } from '../VoteRepository';
import { DraftRepository } from '../DraftRepository';
import {
  PollId,
  QuestionId,
  AnswerId,
  UserId,
  VoteId,
  VoteDraftId,
  ParticipantId,
  ParticipantWeightHistoryId,
} from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';

const pollId = PollId.parse('poll-1');
const questionId = QuestionId.parse('question-1');
const answerId = AnswerId.parse('answer-1');
const userId = UserId.parse('user-1');
const participantId = ParticipantId.parse('participant-1');
const weight = VotingWeight.parse(2.5);
Vote.create(
  questionId,
  answerId,
  userId,
  weight,
  testCreation(VoteId, 'vote-1')
);
VoteDraft.create(
  pollId,
  questionId,
  answerId,
  userId,
  testCreation(VoteDraftId, 'draft-1')
);
PollParticipant.create(
  pollId,
  userId,
  testCreation(ParticipantId, 'participant-1'),
  weight
);
ParticipantWeightHistory.create(
  participantId,
  pollId,
  userId,
  weight,
  weight,
  userId,
  testCreation(ParticipantWeightHistoryId, 'history-1')
);
declare const draft: VoteDraft;
declare const votes: VoteRepository;
declare const drafts: DraftRepository;
votes.getUserVotes(pollId, userId);
drafts.deleteDraftByAnswer(pollId, questionId, answerId, userId);
draft.touch(Instant.parse('2026-01-01T00:00:00.000Z'));

// @ts-expect-error A raw number has not passed voting-weight validation.
const rawWeight: VotingWeight = 1;
Vote.create(
  // @ts-expect-error Question and answer identities cannot be swapped.
  answerId,
  questionId,
  userId,
  weight,
  testCreation(VoteId, 'vote-1')
);
Vote.create(
  questionId,
  answerId,
  userId,
  weight,
  // @ts-expect-error A vote cannot borrow a draft's identity.
  testCreation(VoteDraftId, 'draft-1')
);
// @ts-expect-error Cast time and identity are supplied together.
Vote.create(questionId, answerId, userId, weight, new Date());
ParticipantWeightHistory.create(
  // @ts-expect-error An empty unsaved participant ID is forbidden.
  '',
  pollId,
  userId,
  weight,
  weight,
  userId,
  testCreation(ParticipantWeightHistoryId, 'history-1')
);
// @ts-expect-error Participant creation cannot omit identity/time.
PollParticipant.create(pollId, userId);
// @ts-expect-error Draft refresh requires validated explicit time.
draft.touch(new Date());
// @ts-expect-error Identity cannot change after creation.
draft.id = VoteDraftId.parse('draft-2');
// @ts-expect-error Vote queries cannot interchange poll and user identities.
votes.getUserVotes(userId, pollId);
// @ts-expect-error Draft queries preserve the distinction between questions and answers.
drafts.deleteDraftByAnswer(pollId, answerId, questionId, userId);

import { AssetSize } from '../../organization/PropertyValues';
const size = AssetSize.parse(2.5);
declare const participant: PollParticipant;
// @ts-expect-error An asset size is not the weight of a recorded vote.
Vote.create(questionId, answerId, userId, size, testCreation(VoteId, 'vote-1'));
PollParticipant.create(
  pollId,
  userId,
  testCreation(ParticipantId, 'participant-1'),
  // @ts-expect-error An asset size is not the weight of a participant.
  size
);
// @ts-expect-error Weight changes must preserve their unit at the aggregate boundary.
participant.updateWeight(size);
ParticipantWeightHistory.create(
  participantId,
  pollId,
  userId,
  // @ts-expect-error Audit entries must not accept asset sizes as voting weights.
  size,
  weight,
  userId,
  testCreation(ParticipantWeightHistoryId, 'history-1')
);
