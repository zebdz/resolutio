import { describe, it, expect } from 'vitest';
import { Invitation } from '../Invitation';
import { InvitationDomainCodes } from '../InvitationDomainCodes';

function makeInvitation(
  overrides?: Partial<Parameters<typeof Invitation.reconstitute>[0]>
) {
  return Invitation.reconstitute({
    id: 'inv-1',
    organizationId: 'org-1',
    boardId: null,
    inviterId: 'user-1',
    inviteeId: 'user-2',
    type: 'admin_invite',
    status: 'pending',
    createdAt: new Date(),
    handledAt: null,
    ...overrides,
  });
}

describe('Invitation.create', () => {
  it('should create a pending admin invitation', () => {
    const inv = Invitation.create('org-1', 'user-1', 'user-2', 'admin_invite');

    expect(inv.organizationId).toBe('org-1');
    expect(inv.inviterId).toBe('user-1');
    expect(inv.inviteeId).toBe('user-2');
    expect(inv.type).toBe('admin_invite');
    expect(inv.status).toBe('pending');
    expect(inv.boardId).toBeNull();
    expect(inv.handledAt).toBeNull();
    expect(inv.isPending()).toBe(true);
  });

  it('should create a board member invitation with boardId', () => {
    const inv = Invitation.create(
      'org-1',
      'user-1',
      'user-2',
      'board_member_invite',
      'board-1'
    );

    expect(inv.type).toBe('board_member_invite');
    expect(inv.boardId).toBe('board-1');
  });

  it('should create a member invitation', () => {
    const inv = Invitation.create('org-1', 'user-1', 'user-2', 'member_invite');

    expect(inv.type).toBe('member_invite');
  });
});

describe('Invitation.accept', () => {
  it('should accept a pending invitation', () => {
    const inv = makeInvitation();
    const result = inv.accept();

    expect(result.success).toBe(true);
    expect(inv.status).toBe('accepted');
    expect(inv.handledAt).toBeInstanceOf(Date);
    expect(inv.isPending()).toBe(false);
  });

  it('should fail to accept a non-pending invitation', () => {
    const inv = makeInvitation({ status: 'declined' });
    const result = inv.accept();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationDomainCodes.NOT_PENDING);
    }
  });

  it('should fail to accept an already accepted invitation', () => {
    const inv = makeInvitation({ status: 'accepted' });
    const result = inv.accept();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationDomainCodes.NOT_PENDING);
    }
  });
});

describe('Invitation.decline', () => {
  it('should decline a pending invitation', () => {
    const inv = makeInvitation();
    const result = inv.decline();

    expect(result.success).toBe(true);
    expect(inv.status).toBe('declined');
    expect(inv.handledAt).toBeInstanceOf(Date);
  });

  it('should fail to decline a non-pending invitation', () => {
    const inv = makeInvitation({ status: 'revoked' });
    const result = inv.decline();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationDomainCodes.NOT_PENDING);
    }
  });
});

describe('Invitation.revoke', () => {
  it('should revoke a pending invitation', () => {
    const inv = makeInvitation();
    const result = inv.revoke();

    expect(result.success).toBe(true);
    expect(inv.status).toBe('revoked');
    expect(inv.handledAt).toBeInstanceOf(Date);
  });

  it('should fail to revoke a non-pending invitation', () => {
    const inv = makeInvitation({ status: 'accepted' });
    const result = inv.revoke();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationDomainCodes.NOT_PENDING);
    }
  });
});

describe('Invitation.toJSON', () => {
  it('should return all props', () => {
    const now = new Date();
    const inv = makeInvitation({
      id: 'inv-123',
      organizationId: 'org-456',
      boardId: 'board-789',
      inviterId: 'inviter-1',
      inviteeId: 'invitee-1',
      type: 'board_member_invite',
      status: 'pending',
      createdAt: now,
      handledAt: null,
    });

    const json = inv.toJSON();

    expect(json).toEqual({
      id: 'inv-123',
      organizationId: 'org-456',
      boardId: 'board-789',
      inviterId: 'inviter-1',
      inviteeId: 'invitee-1',
      type: 'board_member_invite',
      status: 'pending',
      createdAt: now,
      handledAt: null,
    });
  });
});
