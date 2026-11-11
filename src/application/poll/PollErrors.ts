// Poll-related error codes
// These should be translated at the presentation layer
import { PollFailure } from '../../domain/poll/Poll';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
export const PollErrors = {
  // Poll
  NOT_FOUND: 'poll.errors.pollNotFound',
  CANNOT_MODIFY_FINISHED: 'poll.errors.cannotModifyFinished',
  CANNOT_MODIFY_ACTIVE: 'poll.errors.cannotModifyActive',
  CANNOT_MODIFY_HAS_VOTES: 'poll.errors.cannotModifyHasVotes',
  CANNOT_MODIFY_SUBMITTED: 'poll.errors.cannotModifySubmitted',
  NOT_POLL_CREATOR: 'poll.errors.notPollCreator',
  NOT_BOARD_MEMBER: 'poll.errors.notBoardMember',
  NOT_ORG_MEMBER: 'poll.errors.notOrgMember',
  BOARD_NOT_FOUND: 'poll.errors.boardNotFound',
  NOT_AUTHORIZED: 'poll.errors.notAuthorized',
  ORGANIZATION_ARCHIVED: 'poll.errors.organizationArchived',
  BOARD_ARCHIVED: 'poll.errors.boardArchived',

  // Question
  QUESTION_NOT_FOUND: 'poll.errors.questionNotFound',
  NO_ANSWERS: 'poll.errors.atLeastOneAnswer',
  NO_UPDATES: 'poll.errors.noUpdates',

  // Answer
  ANSWER_NOT_FOUND: 'poll.errors.answerNotFound',
  PARTICIPANT_NOT_FOUND: 'poll.errors.participantNotFound',

  CANNOT_CHANGE_WEIGHT_CONFIG: 'poll.errors.cannotChangeWeightConfig',

  // Open polls
  OPEN_PARTICIPANTS_IMMUTABLE: 'poll.errors.openParticipantsImmutable',
  OPEN_CONFIG_FIXED: 'poll.errors.openConfigFixed',
} as const;

export type PollError = (typeof PollErrors)[keyof typeof PollErrors];

/** Common poll application failures; cross-context operations add their own
 * dependency failures explicitly rather than widening the contract to string. */
export type PollUseCaseFailure =
  | PollError
  | PollFailure
  | PollWriteFailure
  | 'common.errors.validationFailed';
