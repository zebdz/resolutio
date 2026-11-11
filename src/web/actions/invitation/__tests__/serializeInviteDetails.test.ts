/** Invitation web payloads keep their Date and empty-label compatibility while
 * application projections retain explicit absence and typed references. */
import { expect, it } from 'vitest';
import { Invitation } from '@/domain/invitation/Invitation';
import { GetInviteDetailsUseCase } from '@/application/invitation/GetInviteDetailsUseCase';
import { serializeInviteDetails } from '../serializeInviteDetails';

it('serializes unresolved invitation references without losing the target or creation time', async () => {
  const invitation = Invitation.reconstitute({
    id: 'invitation',
    organizationId: 'organization',
    inviterId: 'inviter',
    inviteeId: 'invitee',
    type: 'board_member_invite',
    boardId: 'board',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    handledAt: null,
  });
  const useCase = new GetInviteDetailsUseCase({
    invitationRepository: { findById: async () => invitation },
    organizationRepository: { findById: async () => null },
    boardRepository: { findById: async () => null },
    userRepository: { findById: async () => null },
  });
  const result = await useCase.execute('invitation');
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.organizationName).toBeNull();
  expect(result.value.inviterName).toBeNull();
  expect(result.value.createdAt).toBe('2026-01-01T00:00:00.000Z');
  expect(serializeInviteDetails(result.value)).toEqual({
    id: 'invitation',
    organizationId: 'organization',
    organizationName: '',
    inviteeId: 'invitee',
    inviterName: '',
    type: 'board_member_invite',
    boardId: 'board',
    boardName: null,
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
});
