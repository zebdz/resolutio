// Poll domain codes
// These should be translated at the presentation layer
export const PollDomainCodes = {
  // Poll validation
  POLL_TITLE_EMPTY: 'domain.poll.titleEmpty',
  POLL_TITLE_TOO_LONG: 'domain.poll.titleTooLong',
  POLL_DESCRIPTION_EMPTY: 'domain.poll.descriptionEmpty',
  POLL_DESCRIPTION_TOO_LONG: 'domain.poll.descriptionTooLong',
  POLL_INVALID_DATES: 'domain.poll.invalidDates',

  // Poll state
  POLL_ALREADY_ACTIVE: 'domain.poll.alreadyActive',
  POLL_ALREADY_INACTIVE: 'domain.poll.alreadyInactive',
  POLL_FINISHED: 'domain.poll.pollFinished',
  POLL_ALREADY_FINISHED: 'domain.poll.alreadyFinished',
  POLL_ALREADY_ARCHIVED: 'domain.poll.alreadyArchived',
  POLL_NO_QUESTIONS: 'domain.poll.noQuestions',
  POLL_CANNOT_ACTIVATE_FINISHED: 'domain.poll.cannotActivateFinished',
  POLL_CANNOT_DEACTIVATE_FINISHED: 'domain.poll.cannotDeactivateFinished',
  POLL_CANNOT_UPDATE_FINISHED: 'domain.poll.cannotUpdateFinished',
  POLL_CANNOT_ADD_QUESTION_FINISHED: 'domain.poll.cannotAddQuestionFinished',
  POLL_CANNOT_ADD_QUESTION_ARCHIVED: 'domain.poll.cannotAddQuestionArchived',
  POLL_CANNOT_REMOVE_QUESTION_FINISHED:
    'domain.poll.cannotRemoveQuestionFinished',
  POLL_CANNOT_REMOVE_QUESTION_ARCHIVED:
    'domain.poll.cannotRemoveQuestionArchived',
  QUESTION_NOT_FOUND: 'domain.poll.questionNotFound',

  // Question validation
  QUESTION_TEXT_EMPTY: 'domain.poll.questionTextEmpty',
  QUESTION_TEXT_TOO_LONG: 'domain.poll.questionTextTooLong',
  QUESTION_DETAILS_TOO_LONG: 'domain.poll.questionDetailsTooLong',
  QUESTION_INVALID_PAGE: 'domain.poll.questionInvalidPage',
  QUESTION_INVALID_ORDER: 'domain.poll.questionInvalidOrder',
  QUESTION_INVALID_TYPE: 'domain.poll.questionInvalidType',
  QUESTION_ALREADY_ARCHIVED: 'domain.poll.questionAlreadyArchived',
  QUESTION_CANNOT_ADD_ANSWER_ARCHIVED:
    'domain.poll.questionCannotAddAnswerArchived',
  QUESTION_CANNOT_REMOVE_ANSWER_ARCHIVED:
    'domain.poll.questionCannotRemoveAnswerArchived',
  QUESTION_ANSWER_NOT_FOUND: 'domain.poll.questionAnswerNotFound',

  // Answer validation
  ANSWER_TEXT_EMPTY: 'domain.poll.answerTextEmpty',
  ANSWER_TEXT_TOO_LONG: 'domain.poll.answerTextTooLong',
  ANSWER_INVALID_ORDER: 'domain.poll.answerInvalidOrder',
  ANSWER_ALREADY_ARCHIVED: 'domain.poll.answerAlreadyArchived',

  // Vote validation
  INVALID_WEIGHT: 'domain.poll.invalidWeight',
  ALREADY_VOTED: 'domain.poll.alreadyVoted',
  NOT_PARTICIPANT: 'domain.poll.notParticipant',
  POLL_NOT_ACTIVE: 'domain.poll.pollNotActive',
  MUST_ANSWER_ALL_QUESTIONS: 'domain.poll.mustAnswerAllQuestions',
  CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES:
    'domain.poll.cannotModifyParticipantsHasVotes',
} as const;

export type PollDomainCode =
  (typeof PollDomainCodes)[keyof typeof PollDomainCodes];
