/** Canonical board names are nonempty, trimmed and bounded. Request decoding trims input;
 * persisted values must already be canonical so reads never rewrite stored names. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { BoardDomainCodes, BoardDomainCode } from './BoardDomainCodes';

export const BOARD_NAME_MAX_LENGTH = 255;
export const BoardName = z
  .string()
  .min(1)
  .max(BOARD_NAME_MAX_LENGTH)
  .refine((value) => value === value.trim())
  .brand<'BoardName'>();
export type BoardName = z.infer<typeof BoardName>;

export function parseBoardName(
  value: unknown
): Result<BoardName, BoardDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(BoardDomainCodes.BOARD_NAME_EMPTY);
  }

  // Preserve the original request-length limit before normalization.
  if (value.length > BOARD_NAME_MAX_LENGTH) {
    return failure(BoardDomainCodes.BOARD_NAME_TOO_LONG);
  }

  return success(BoardName.parse(value.trim()));
}
