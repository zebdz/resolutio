export const ReportDomainCodes = {
  REPORT_TITLE_EMPTY: 'domain.report.titleEmpty',
  REPORT_TITLE_TOO_LONG: 'domain.report.titleTooLong',
  REPORT_BODY_EMPTY: 'domain.report.bodyEmpty',
  REPORT_BODY_TOO_LONG: 'domain.report.bodyTooLong',
  REPORT_BODY_INVALID_ATTACHMENT_REF: 'domain.report.bodyInvalidAttachmentRef',

  REPORT_INVALID_VISIBILITY: 'domain.report.invalidVisibility',
  REPORT_BOARDS_EMPTY: 'domain.report.boardsEmpty',
  REPORT_BOARD_NOT_IN_ORG: 'domain.report.boardNotInOrg',

  REPORT_MUST_BE_DRAFT: 'domain.report.mustBeDraft',
  REPORT_MUST_BE_PUBLISHED: 'domain.report.mustBePublished',
  REPORT_CANNOT_EDIT_PUBLISHED: 'domain.report.cannotEditPublished',
  REPORT_ALREADY_ARCHIVED: 'domain.report.alreadyArchived',
  REPORT_ARCHIVED: 'domain.report.archived',

  REPORT_ATTACHMENT_FILENAME_EMPTY: 'domain.report.attachmentFilenameEmpty',
  REPORT_ATTACHMENT_TOO_LARGE: 'domain.report.attachmentTooLarge',
  REPORT_ATTACHMENT_TYPE_NOT_ALLOWED: 'domain.report.attachmentTypeNotAllowed',
  REPORT_ATTACHMENT_MAGIC_MISMATCH: 'domain.report.attachmentMagicMismatch',
  REPORT_ATTACHMENT_LIMIT_REACHED: 'domain.report.attachmentLimitReached',

  REPORT_POLL_AUDIENCE_TOO_NARROW: 'domain.report.pollAudienceTooNarrow',
  REPORT_POLL_NOT_FOUND: 'domain.report.pollNotFound',
} as const;

export type ReportDomainCode =
  (typeof ReportDomainCodes)[keyof typeof ReportDomainCodes];
