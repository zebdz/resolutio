/** Test clients choose fixed token entropy, identity and time. Text/limit casts
 * are restricted to this fixture so malformed-input tests still exercise domain guards. */
import { JoinToken } from '../JoinToken';
import {
  JoinTokenDescription,
  JoinTokenMaxUses,
  JoinTokenValue,
} from '../JoinTokenValues';
import { JoinTokenId, OrganizationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
export const joinTokenInstant = Instant.parse('2026-01-01T00:00:00.000Z');

export function createJoinToken(
  organizationId: string,
  createdById: string,
  description: string,
  maxUses: number | null = null,
  profanityChecker?: ProfanityChecker
) {
  return JoinToken.create(
    {
      organizationId: OrganizationId.parse(organizationId),
      createdById: UserId.parse(createdById),
      description: description as JoinTokenDescription,
      maxUses: maxUses as JoinTokenMaxUses | null,
      token: JoinTokenValue.parse('abc234defg'),
    },
    { id: JoinTokenId.parse('join-fixture'), now: joinTokenInstant },
    profanityChecker
  );
}

export const joinTokenCreationInputs = {
  ids: {
    generate: <Id extends string>(schema: { parse(raw: unknown): Id }) =>
      schema.parse('created-token'),
  },
  clock: { now: () => joinTokenInstant },
  tokens: { generate: () => JoinTokenValue.parse('abc234defg') },
};
