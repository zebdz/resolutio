/** Known report application failures preserve domain codes and boundary errors.
 * Presentation translates these codes; adapters must not leak arbitrary messages. */
import { ReportFailure } from '../../domain/report/Report';

export const ReportErrors = {
  NOT_AUTHENTICATED: 'common.errors.unauthorized',
  NOT_ORG_MEMBER: 'organization.errors.notMember',
  NOT_ORG_ADMIN: 'organization.errors.notAdmin',
  NOT_AUTHOR_OR_ADMIN: 'report.errors.notAuthorOrAdmin',
  REPORT_NOT_FOUND: 'report.errors.notFound',
  ATTACHMENT_NOT_FOUND: 'report.errors.attachmentNotFound',
  RATE_LIMITED_DAILY: 'report.errors.rateLimitedDaily',
} as const;

export type ReportError = (typeof ReportErrors)[keyof typeof ReportErrors];
export type ReportUseCaseFailure =
  | ReportError
  | ReportFailure
  | 'common.errors.validationFailed'
  | 'common.errors.unexpected';
