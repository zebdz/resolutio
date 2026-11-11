/** Authorized voting payloads retain validated poll references, content and position units.
 * Explicit mapping keeps nested entities, actor identities and persistence times on the server. */
import type { GetUserVotingProgressResult } from '@/application/poll/GetUserVotingProgressUseCase';
import type {
  PollId,
  QuestionId,
  AnswerId,
  VoteDraftId,
  PollAttachmentId,
} from '@/domain/shared/EntityIds';
import type { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import type {
  QuestionText,
  QuestionDetails,
  AnswerText,
  PageNumber,
  SortOrder,
  QuestionCount,
} from '@/domain/poll/QuestionValues';
import type { PollType } from '@/domain/poll/PollType';
import type { QuestionType } from '@/domain/poll/QuestionType';
import type { VotingEligibilityFailure } from '@/domain/poll/PollVotingPolicy';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import type { Result } from '@/domain/shared/Result';

// Keys under poll.voting. Exhaustiveness prevents a new denial from losing its explanation.
const denialReasons = {
  [PollDomainCodes.POLL_FINISHED]: 'pollFinished',
  [PollDomainCodes.POLL_NOT_ACTIVE]: 'pollNotActive',
  [PollDomainCodes.NOT_PARTICIPANT]: 'cannotVote',
  [PollDomainCodes.USER_NOT_CONFIRMED]: 'notConfirmed',
  [PollDomainCodes.ALREADY_VOTED]: 'alreadyVoted',
} as const satisfies Record<VotingEligibilityFailure, string>;

export type CanVoteView =
  | { readonly canVote: true }
  | {
      readonly canVote: false;
      readonly reasonCode: (typeof denialReasons)[VotingEligibilityFailure];
    };

export function votingEligibilityView(
  result: Result<void, VotingEligibilityFailure>
): CanVoteView {
  return result.success
    ? { canVote: true }
    : { canVote: false, reasonCode: denialReasons[result.error] };
}

export interface VotingQuestionView {
  id: QuestionId;
  text: QuestionText;
  details: QuestionDetails | null;
  page: PageNumber;
  order: SortOrder;
  questionType: QuestionType;
  answers: { id: AnswerId; text: AnswerText; order: SortOrder }[];
}

export interface VotingPollView {
  id: PollId;
  title: PollTitle;
  description: PollDescription;
  // Ids allow the renderer to refuse refs to other polls' files; bytes remain server-side.
  attachmentIds: PollAttachmentId[];
  pollType: PollType;
  anonymous: boolean;
  // Only ownership-weighted polls put holdings in the named protocol.
  isPropertyBased: boolean;
  questions: VotingQuestionView[];
}

export interface VotingDraftView {
  id: VoteDraftId;
  questionId: QuestionId;
  answerId: AnswerId;
}

export interface VotingProgressView {
  poll: VotingPollView;
  drafts: VotingDraftView[];
  hasFinished: boolean;
  canVote: boolean;
  answeredQuestionIds: QuestionId[];
  totalQuestions: QuestionCount;
}

export function serializeVotingProgress(
  source: GetUserVotingProgressResult
): VotingProgressView {
  const { poll } = source;

  return {
    poll: {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      attachmentIds: [...poll.attachmentIds],
      pollType: poll.pollType,
      anonymous: poll.isAnonymous(),
      isPropertyBased:
        poll.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
        poll.distributionType === 'OWNERSHIP_SIZE_WEIGHTED',
      questions: poll.questions.map((question) => ({
        id: question.id,
        text: question.text,
        details: question.details,
        page: question.page,
        order: question.order,
        questionType: question.questionType,
        answers: question.answers.map((answer) => ({
          id: answer.id,
          text: answer.text,
          order: answer.order,
        })),
      })),
    },
    drafts: source.drafts.map((draft) => ({
      id: draft.id,
      questionId: draft.questionId,
      answerId: draft.answerId,
    })),
    hasFinished: source.hasFinished,
    canVote: source.canVote,
    answeredQuestionIds: [...source.answeredQuestionIds],
    totalQuestions: source.totalQuestions,
  };
}
