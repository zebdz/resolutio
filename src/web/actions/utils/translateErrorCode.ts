import { getTranslations } from 'next-intl/server';
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
import { PASSWORD_MIN_LENGTH } from '@/domain/user/User';
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

// Maps error codes to ICU message parameters (limit values from domain constants)
const ERROR_CODE_PARAMS: Record<string, Record<string, string | number>> = {
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

/**
 * Translates an error code into a localized message.
 *
 * Error codes follow dotted paths that map directly to message keys:
 *   "organization.errors.notFound"          → messages.organization.errors.notFound
 *   "domain.organization.organizationNameEmpty" → messages.domain.organization.organizationNameEmpty
 *
 * The first segment is used as the namespace for getTranslations(),
 * and the rest becomes the key within that namespace.
 *
 * If the error code has associated params (e.g. maxLength for TooLong errors),
 * they are automatically looked up from ERROR_CODE_PARAMS and passed to the
 * ICU message formatter.
 */
export async function translateErrorCode(
  errorCode: string,
  paramsOrLocale?: Record<string, string | number> | { locale: string },
  maybeLocale?: { locale: string }
): Promise<string> {
  const dotIndex = errorCode.indexOf('.');

  if (dotIndex === -1) {
    return errorCode;
  }

  const namespace = errorCode.substring(0, dotIndex);
  const key = errorCode.substring(dotIndex + 1);

  // Caller may pass: (code), (code, params), (code, { locale }),
  // or (code, params, { locale }). Disambiguate.
  let params: Record<string, string | number> | undefined;
  let localeOpts: { locale: string } | undefined;

  if (
    paramsOrLocale &&
    typeof (paramsOrLocale as { locale?: unknown }).locale === 'string'
  ) {
    localeOpts = paramsOrLocale as { locale: string };
  } else {
    params = paramsOrLocale as Record<string, string | number> | undefined;
    localeOpts = maybeLocale;
  }

  const resolvedParams = params || ERROR_CODE_PARAMS[errorCode];

  try {
    const t = localeOpts
      ? await getTranslations({ locale: localeOpts.locale, namespace })
      : await getTranslations(namespace);

    return resolvedParams ? t(key as any, resolvedParams) : t(key as any);
  } catch {
    return errorCode;
  }
}
