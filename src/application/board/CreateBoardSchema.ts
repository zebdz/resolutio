import { z } from 'zod';
import { BOARD_NAME_MAX_LENGTH } from '../../domain/board/Board';
import { BoardDomainCodes } from '../../domain/board/BoardDomainCodes';

export const CreateBoardSchema = z.object({
  name: z
    .string()
    .min(1, BoardDomainCodes.BOARD_NAME_EMPTY)
    .max(BOARD_NAME_MAX_LENGTH, BoardDomainCodes.BOARD_NAME_TOO_LONG),
  organizationId: z.string().cuid('Invalid organization ID'),
});

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
