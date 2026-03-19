import { z } from 'zod';
import { BOARD_NAME_MAX_LENGTH } from '../../domain/board/Board';
import { BoardDomainCodes } from '../../domain/board/BoardDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createBoardSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    name: z
      .string()
      .min(1, BoardDomainCodes.BOARD_NAME_EMPTY)
      .max(BOARD_NAME_MAX_LENGTH, BoardDomainCodes.BOARD_NAME_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    organizationId: z.string().cuid('Invalid organization ID'),
  });

// Keep backward-compatible constant with a no-op profanity checker for tests
export const CreateBoardSchema = createBoardSchema({
  containsProfanity: () => false,
});

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
