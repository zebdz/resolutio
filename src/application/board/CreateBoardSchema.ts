import { z } from 'zod';
import { BOARD_NAME_MAX_LENGTH } from '../../domain/board/Board';

export const CreateBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board name is required')
    .max(
      BOARD_NAME_MAX_LENGTH,
      `Board name must be at most ${BOARD_NAME_MAX_LENGTH} characters`
    ),
  organizationId: z.string().cuid('Invalid organization ID'),
});

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
