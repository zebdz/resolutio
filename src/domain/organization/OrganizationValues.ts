/** Organization vocabulary and validated text values. Names and descriptions
 * preserve existing validation/error codes; hierarchy placement has explicit variants. */
import { z } from 'zod';
import { OrganizationId } from '../shared/EntityIds';
import { Result, success, failure } from '../shared/Result';
import {
  OrganizationDomainCode,
  OrganizationDomainCodes as Codes,
} from './OrganizationDomainCodes';
export const ORGANIZATION_NAME_MIN_LENGTH = 1;
export const ORGANIZATION_NAME_MAX_LENGTH = 255;
// Letters, digits, whitespace, hyphens, quotes and parentheses. The quote set
// covers guillemets («») and typographic quotes as well as the ASCII one —
// Russian names are written with guillemets, and Russian is the default
// language. Parentheses carry qualifiers such as "(филиал №2)".
export const ORGANIZATION_NAME_PATTERN = /^[\p{L}\p{N}\s\-"«»„“”‘’()]+$/u;
export const ORGANIZATION_DESCRIPTION_MAX_LENGTH = 2000;
// Historical names remain readable/editable even when current naming rules changed.
export const OrganizationName = z
  .string()
  .max(ORGANIZATION_NAME_MAX_LENGTH)
  .refine((value) => value.trim().length > 0)
  .brand<'OrganizationName'>();
export type OrganizationName = z.infer<typeof OrganizationName>;
export const NewOrganizationName = z
  .string()
  .trim()
  .min(ORGANIZATION_NAME_MIN_LENGTH)
  .max(ORGANIZATION_NAME_MAX_LENGTH)
  .regex(ORGANIZATION_NAME_PATTERN)
  .pipe(OrganizationName)
  .brand<'NewOrganizationName'>();
export type NewOrganizationName = z.infer<typeof NewOrganizationName>;
export const OrganizationDescription = z
  .string()
  .max(ORGANIZATION_DESCRIPTION_MAX_LENGTH)
  .trim()
  .min(1)
  .brand<'OrganizationDescription'>();
export type OrganizationDescription = z.infer<typeof OrganizationDescription>;
export const OrganizationPlacement = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('root'),
      allowMultiTreeMembership: z.boolean(),
    }),
    z.object({ kind: z.literal('child'), parentId: OrganizationId }),
  ])
  .readonly();
export type OrganizationPlacement = z.infer<typeof OrganizationPlacement>;

export function parseOrganizationName(
  value: unknown
): Result<NewOrganizationName, OrganizationDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.ORGANIZATION_NAME_EMPTY);
  }

  if (value.trim().length < ORGANIZATION_NAME_MIN_LENGTH) {
    return failure(Codes.ORGANIZATION_NAME_TOO_SHORT);
  }

  if (value.trim().length > ORGANIZATION_NAME_MAX_LENGTH) {
    return failure(Codes.ORGANIZATION_NAME_TOO_LONG);
  }

  if (!ORGANIZATION_NAME_PATTERN.test(value.trim())) {
    return failure(Codes.ORGANIZATION_NAME_INVALID_CHARS);
  }

  return success(NewOrganizationName.parse(value));
}

export function parseOrganizationDescription(
  value: unknown
): Result<OrganizationDescription, OrganizationDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.ORGANIZATION_DESCRIPTION_EMPTY);
  }

  if (value.length > ORGANIZATION_DESCRIPTION_MAX_LENGTH) {
    return failure(Codes.ORGANIZATION_DESCRIPTION_TOO_LONG);
  }

  return success(OrganizationDescription.parse(value));
}

export const MemberRemovalReason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<'OrganizationMemberRemovalReason'>();
export type MemberRemovalReason = z.infer<typeof MemberRemovalReason>;

/** Validated number of members; distinct from other count units. */
export const MemberCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'MemberCount'>();
export type MemberCount = z.infer<typeof MemberCount>;
