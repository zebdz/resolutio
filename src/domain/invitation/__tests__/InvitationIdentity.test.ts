/** Invitation loading and transitions must preserve meaningful identity and state.
 * Persistence cannot construct a handled invitation without its decision time. */
import { expect, it } from 'vitest';
import { Invitation } from '../Invitation';
import { InvitationId, OrganizationId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';

const data = {
  id: 'invite-1',
  organizationId: 'org-1',
  inviterId: 'user-1',
  inviteeId: 'user-2',
  type: 'admin_invite' as const,
  boardId: null,
  status: 'pending' as const,
  createdAt: new Date('2026-01-01'),
  handledAt: null,
};

it('rejects persisted invitations without identity', () => {
  expect(() => Invitation.reconstitute({ ...data, id: '' })).toThrow();
});

it('receives identity and time before creation', () => {
  const creation = testCreation(InvitationId, 'assigned-invitation');
  const invite = Invitation.create(
    OrganizationId.parse('org-1'),
    UserId.parse('user-1'),
    UserId.parse('user-2'),
    { type: 'admin_invite', boardId: null },
    creation
  );
  expect(invite.id).toBe(creation.id);
  expect(invite.createdAt.toISOString()).toBe(creation.now);
});
