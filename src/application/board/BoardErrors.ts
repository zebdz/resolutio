export const BoardErrors = {
  NOT_FOUND: 'board.errors.notFound',
  CANNOT_ARCHIVE_GENERAL: 'board.errors.cannotArchiveGeneral',
  USER_NOT_ORG_MEMBER: 'board.errors.userNotOrgMember',
  ALREADY_MEMBER: 'board.errors.alreadyMember',
  BOARD_ARCHIVED: 'board.errors.boardArchived',
  NOT_MEMBER: 'board.errors.notMember',
  LEAVE_FAILED: 'board.errors.leaveFailed',
} as const;

export type BoardError = (typeof BoardErrors)[keyof typeof BoardErrors];
export type BoardUseCaseError =
  | BoardError
  | import('@/domain/board/Board').BoardFailure
  | import('../organization/OrganizationErrors').OrganizationError
  | 'common.errors.validationFailed';
