import { z } from 'zod';
import { JOIN_TOKEN_DESCRIPTION_MAX_LENGTH } from '../../domain/organization/JoinToken';
import { JoinTokenDomainCodes } from '../../domain/organization/JoinTokenDomainCodes';

export const CreateJoinTokenSchema = z.object({
  organizationId: z.string().min(1),
  description: z
    .string()
    .min(1, JoinTokenDomainCodes.DESCRIPTION_EMPTY)
    .max(
      JOIN_TOKEN_DESCRIPTION_MAX_LENGTH,
      JoinTokenDomainCodes.DESCRIPTION_TOO_LONG
    )
    .trim(),
  maxUses: z
    .number()
    .int()
    .positive(JoinTokenDomainCodes.MAX_USES_INVALID)
    .nullable()
    .optional(),
});

export type CreateJoinTokenInput = z.infer<typeof CreateJoinTokenSchema>;
