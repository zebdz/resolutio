import { describe, it, expect } from 'vitest';
import {
  JoinParentRequest,
  JoinParentRequestProps,
} from '../JoinParentRequest';
import { JoinParentRequestDomainCodes } from '../JoinParentRequestDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

function makePendingRequest(
  overrides?: Partial<JoinParentRequestProps>
): JoinParentRequest {
  return JoinParentRequest.reconstitute({
    id: 'req-1',
    childOrgId: 'child-1',
    parentOrgId: 'parent-1',
    requestingAdminId: 'admin-1',
    handlingAdminId: null,
    message: 'Test message',
    status: 'pending',
    rejectionReason: null,
    createdAt: new Date(),
    handledAt: null,
    ...overrides,
  });
}

describe('JoinParentRequest.create profanity check', () => {
  it('should reject message with profanity', () => {
    const result = JoinParentRequest.create(
      'child-1',
      'parent-1',
      'admin-1',
      'badword message',
      mockProfanityChecker
    );
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  });

  it('should pass clean message with profanityChecker', () => {
    const result = JoinParentRequest.create(
      'child-1',
      'parent-1',
      'admin-1',
      'Clean message',
      mockProfanityChecker
    );
    expect(result.success).toBe(true);
  });

  it('should pass without profanityChecker (backward compat)', () => {
    const result = JoinParentRequest.create(
      'child-1',
      'parent-1',
      'admin-1',
      'Any message'
    );
    expect(result.success).toBe(true);
  });
});

describe('JoinParentRequest.reject profanity check', () => {
  it('should reject reason with profanity', () => {
    const request = makePendingRequest();
    const result = request.reject(
      'admin-2',
      'badword reason',
      mockProfanityChecker
    );
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    // Status should remain pending
    expect(request.status).toBe('pending');
  });

  it('should pass clean reason with profanityChecker', () => {
    const request = makePendingRequest();
    const result = request.reject(
      'admin-2',
      'Valid rejection reason',
      mockProfanityChecker
    );
    expect(result.success).toBe(true);
    expect(request.status).toBe('rejected');
  });

  it('should pass without profanityChecker (backward compat)', () => {
    const request = makePendingRequest();
    const result = request.reject('admin-2', 'Any reason');
    expect(result.success).toBe(true);
    expect(request.status).toBe('rejected');
  });
});
