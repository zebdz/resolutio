// Domain-level codes
// These represent validation errors at the entity level
export const BoardDomainCodes = {
  // Board validation
  BOARD_NAME_EMPTY: 'domain.board.boardNameEmpty',
  BOARD_NAME_TOO_LONG: 'domain.board.boardNameTooLong',
  BOARD_ALREADY_ARCHIVED: 'domain.board.boardAlreadyArchived',
} as const;

export type BoardDomainCode = (typeof BoardDomainCodes)[keyof typeof BoardDomainCodes];
