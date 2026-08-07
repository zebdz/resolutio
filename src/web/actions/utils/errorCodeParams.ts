import {
  ORGANIZATION_NAME_MIN_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from '@/domain/organization/Organization';
import { BOARD_NAME_MAX_LENGTH } from '@/domain/board/Board';
import {
  POLL_TITLE_MAX_LENGTH,
  POLL_DESCRIPTION_MAX_LENGTH,
} from '@/domain/poll/Poll';
import {
  QUESTION_TEXT_MAX_LENGTH,
  QUESTION_DETAILS_MAX_LENGTH,
} from '@/domain/poll/Question';
import { ANSWER_TEXT_MAX_LENGTH } from '@/domain/poll/Answer';
import { JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH } from '@/domain/organization/JoinParentRequest';
import { JOIN_TOKEN_DESCRIPTION_MAX_LENGTH } from '@/domain/organization/JoinToken';
import {
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
} from '@/domain/user/User';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '@/domain/user/Nickname';
import { SharedDomainCodes } from '@/domain/shared/SharedDomainCodes';
import {
  REPORT_TITLE_MAX_LENGTH,
  REPORT_BODY_MAX_LENGTH,
} from '@/domain/report/Report';
import {
  REPORT_ATTACHMENT_COUNT_LIMIT,
  REPORT_ATTACHMENT_IMAGE_MAX_BYTES,
  REPORT_ATTACHMENT_PDF_MAX_BYTES,
} from '@/domain/report/ReportAttachment';

/**
 * Maps error codes to ICU message parameters (limit values from domain
 * constants).
 *
 * Shared by both translation paths — `translateErrorCode` for codes returned
 * by use cases, and `translateZodFieldErrors` for codes raised by Zod schemas.
 * A code reachable from either path needs an entry here exactly once: next-intl
 * refuses to format a message whose placeholders have no values and falls back
 * to printing the bare key, so a missing entry surfaces in the UI as
 * "domain.poll.descriptionTooLong" under the input.
 */
export const ERROR_CODE_PARAMS: Record<
  string,
  Record<string, string | number>
> = {
  'domain.organization.organizationNameTooShort': {
    minLength: ORGANIZATION_NAME_MIN_LENGTH,
  },
  'domain.organization.organizationNameTooLong': {
    maxLength: ORGANIZATION_NAME_MAX_LENGTH,
  },
  'domain.organization.organizationDescriptionTooLong': {
    maxLength: ORGANIZATION_DESCRIPTION_MAX_LENGTH,
  },
  'domain.board.boardNameTooLong': { maxLength: BOARD_NAME_MAX_LENGTH },
  'domain.poll.titleTooLong': { maxLength: POLL_TITLE_MAX_LENGTH },
  'domain.poll.descriptionTooLong': { maxLength: POLL_DESCRIPTION_MAX_LENGTH },
  'domain.poll.questionTextTooLong': { maxLength: QUESTION_TEXT_MAX_LENGTH },
  'domain.poll.questionDetailsTooLong': {
    maxLength: QUESTION_DETAILS_MAX_LENGTH,
  },
  'domain.poll.answerTextTooLong': { maxLength: ANSWER_TEXT_MAX_LENGTH },
  'domain.joinParentRequest.messageTooLong': {
    maxLength: JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH,
  },
  'domain.joinToken.descriptionTooLong': {
    maxLength: JOIN_TOKEN_DESCRIPTION_MAX_LENGTH,
  },
  'domain.user.passwordTooShort': { minLength: PASSWORD_MIN_LENGTH },
  'domain.user.nicknameInvalid': {
    minLength: NICKNAME_MIN_LENGTH,
    maxLength: NICKNAME_MAX_LENGTH,
  },
  // RegisterUserSchema raises these through Zod, so they reach the UI via
  // translateZodFieldErrors and need their limits just like the rest.
  'domain.user.firstNameInvalid': {
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  },
  'domain.user.lastNameInvalid': {
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  },
  'domain.user.middleNameInvalid': {
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  },
  'domain.report.titleTooLong': { maxLength: REPORT_TITLE_MAX_LENGTH },
  'domain.report.bodyTooLong': { maxLength: REPORT_BODY_MAX_LENGTH },
  'domain.report.attachmentLimitReached': {
    maxCount: REPORT_ATTACHMENT_COUNT_LIMIT,
  },
  'domain.report.attachmentTooLarge': {
    imageMaxMb: Math.floor(REPORT_ATTACHMENT_IMAGE_MAX_BYTES / (1024 * 1024)),
    documentMaxMb: Math.floor(REPORT_ATTACHMENT_PDF_MAX_BYTES / (1024 * 1024)),
  },
  [SharedDomainCodes.CONTAINS_PROFANITY]: {},
};
