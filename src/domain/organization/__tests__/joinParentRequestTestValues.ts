/** Explicit deterministic parent-request fixtures; casts are limited to invalid
 * text client tests so they can exercise runtime guards without bypassing identity. */
import { JoinParentRequest } from '../JoinParentRequest';
import { JoinParentRequestMessage } from '../JoinParentRequestValues';
import {
  OrganizationId,
  UserId,
  JoinParentRequestId,
} from '../../shared/EntityIds';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
import { Instant } from '../../shared/Instant';
export const parentRequestInstant = Instant.parse('2026-01-01T00:00:00.000Z');
export const parentRequestCreationInputs = {
  ids: {
    generate: <Id extends string>(schema: { parse(raw: unknown): Id }) =>
      schema.parse('created-request'),
  },
  clock: { now: () => parentRequestInstant },
};

export function createJoinParentRequest(
  childOrgId: string,
  parentOrgId: string,
  requestingAdminId: string,
  message: string,
  checker?: ProfanityChecker
) {
  return JoinParentRequest.create(
    {
      childOrgId: OrganizationId.parse(childOrgId),
      parentOrgId: OrganizationId.parse(parentOrgId),
      requestingAdminId: UserId.parse(requestingAdminId),
      message: message as JoinParentRequestMessage,
    },
    {
      id: JoinParentRequestId.parse('request-fixture'),
      now: parentRequestInstant,
    },
    checker
  );
}
