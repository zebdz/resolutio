/** Join links have a fixed readable alphabet and independent, validated usage
 * units. Token text is supplied by an application generation port. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import {
  JoinTokenDomainCode,
  JoinTokenDomainCodes as Codes,
} from './JoinTokenDomainCodes';
export const JOIN_TOKEN_DESCRIPTION_MAX_LENGTH = 500;
export const JOIN_TOKEN_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const JOIN_TOKEN_LENGTH = 10;
export const JoinTokenValue = z
  .string()
  .length(JOIN_TOKEN_LENGTH)
  .regex(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
  .brand<'JoinTokenValue'>();
export type JoinTokenValue = z.infer<typeof JoinTokenValue>;
export const JoinTokenDescription = z
  .string()
  .max(JOIN_TOKEN_DESCRIPTION_MAX_LENGTH)
  .trim()
  .min(1)
  .brand<'JoinTokenDescription'>();
export type JoinTokenDescription = z.infer<typeof JoinTokenDescription>;
export const JoinTokenMaxUses = z
  .number({ error: Codes.MAX_USES_INVALID })
  .int(Codes.MAX_USES_INVALID)
  .positive(Codes.MAX_USES_INVALID)
  .brand<'JoinTokenMaxUses'>();
export type JoinTokenMaxUses = z.infer<typeof JoinTokenMaxUses>;
export const JoinTokenUseCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'JoinTokenUseCount'>();
export type JoinTokenUseCount = z.infer<typeof JoinTokenUseCount>;

export function parseJoinTokenDescription(
  raw: unknown
): Result<JoinTokenDescription, JoinTokenDomainCode> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return failure(Codes.DESCRIPTION_EMPTY);
  }

  if (raw.length > JOIN_TOKEN_DESCRIPTION_MAX_LENGTH) {
    return failure(Codes.DESCRIPTION_TOO_LONG);
  }

  return success(JoinTokenDescription.parse(raw));
}
