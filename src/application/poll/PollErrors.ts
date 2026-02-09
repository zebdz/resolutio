// Poll-related error codes
// These should be translated at the presentation layer
export const PollErrors = {
  // Poll
  NOT_FOUND: 'poll.errors.pollNotFound',
  CANNOT_MODIFY_FINISHED: 'poll.errors.cannotModifyFinished',
  CANNOT_MODIFY_ACTIVE: 'poll.errors.cannotModifyActive',
  CANNOT_MODIFY_HAS_VOTES: 'poll.errors.cannotModifyHasVotes',
  NOT_POLL_CREATOR: 'poll.errors.notPollCreator',
  NOT_BOARD_MEMBER: 'poll.errors.notBoardMember',
  NOT_ORG_MEMBER: 'poll.errors.notOrgMember',
  BOARD_NOT_FOUND: 'poll.errors.boardNotFound',
  NOT_AUTHORIZED: 'poll.errors.notAuthorized',

  // Question
  QUESTION_NOT_FOUND: 'poll.errors.questionNotFound',
  NO_ANSWERS: 'poll.errors.atLeastOneAnswer',
  NO_UPDATES: 'poll.errors.noUpdates',

  // Answer
  ANSWER_NOT_FOUND: 'poll.errors.answerNotFound',
} as const;

export type PollError = (typeof PollErrors)[keyof typeof PollErrors];
