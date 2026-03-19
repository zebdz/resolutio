import { describe, it, expect } from 'vitest';
import { JoinToken, JoinTokenProps } from '../JoinToken';
import { JoinTokenDomainCodes } from '../JoinTokenDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const TOKEN_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';

function makeProps(overrides?: Partial<JoinTokenProps>): JoinTokenProps {
  return {
    id: 'jt-1',
    organizationId: 'org-1',
    token: 'abc123defg',
    description: 'Test token',
    maxUses: null,
    useCount: 0,
    createdById: 'user-1',
    createdAt: new Date(),
    expiredAt: null,
    ...overrides,
  };
}

describe('JoinToken.create', () => {
  it('should succeed with valid description', () => {
    const result = JoinToken.create('org-1', 'user-1', 'Valid description');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.description).toBe('Valid description');
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.createdById).toBe('user-1');
      expect(result.value.maxUses).toBeNull();
      expect(result.value.useCount).toBe(0);
      expect(result.value.expiredAt).toBeNull();
    }
  });

  it('should fail with empty description', () => {
    const result = JoinToken.create('org-1', 'user-1', '');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.DESCRIPTION_EMPTY);
    }
  });

  it('should fail with whitespace-only description', () => {
    const result = JoinToken.create('org-1', 'user-1', '   ');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.DESCRIPTION_EMPTY);
    }
  });

  it('should fail with description > 500 chars', () => {
    const result = JoinToken.create('org-1', 'user-1', 'a'.repeat(501));

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.DESCRIPTION_TOO_LONG);
    }
  });

  it('should fail with maxUses <= 0 (maxUses = 0)', () => {
    const result = JoinToken.create('org-1', 'user-1', 'desc', 0);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.MAX_USES_INVALID);
    }
  });

  it('should fail with maxUses < 0', () => {
    const result = JoinToken.create('org-1', 'user-1', 'desc', -5);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.MAX_USES_INVALID);
    }
  });

  it('should succeed with null maxUses (unlimited)', () => {
    const result = JoinToken.create('org-1', 'user-1', 'desc', null);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.maxUses).toBeNull();
    }
  });

  it('should generate a 10-char token from valid charset', () => {
    const result = JoinToken.create('org-1', 'user-1', 'desc');

    expect(result.success).toBe(true);

    if (result.success) {
      const token = result.value.token;
      expect(token).toHaveLength(10);

      for (const char of token) {
        expect(TOKEN_CHARSET).toContain(char);
      }
    }
  });
});

describe('JoinToken.reconstitute', () => {
  it('should create entity from props', () => {
    const props = makeProps();
    const token = JoinToken.reconstitute(props);

    expect(token.id).toBe(props.id);
    expect(token.organizationId).toBe(props.organizationId);
    expect(token.token).toBe(props.token);
    expect(token.description).toBe(props.description);
    expect(token.maxUses).toBe(props.maxUses);
    expect(token.useCount).toBe(props.useCount);
    expect(token.createdById).toBe(props.createdById);
    expect(token.createdAt).toBe(props.createdAt);
    expect(token.expiredAt).toBe(props.expiredAt);
  });
});

describe('JoinToken.expire', () => {
  it('should set expiredAt', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.expire();

    expect(result.success).toBe(true);
    expect(token.expiredAt).toBeInstanceOf(Date);
  });

  it('should fail if already expired', () => {
    const token = JoinToken.reconstitute(makeProps({ expiredAt: new Date() }));
    const result = token.expire();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.ALREADY_EXPIRED);
    }
  });
});

describe('JoinToken.reactivate', () => {
  it('should clear expiredAt', () => {
    const token = JoinToken.reconstitute(makeProps({ expiredAt: new Date() }));
    const result = token.reactivate();

    expect(result.success).toBe(true);
    expect(token.expiredAt).toBeNull();
  });

  it('should fail if not expired', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.reactivate();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.NOT_EXPIRED);
    }
  });
});

describe('JoinToken.updateMaxUses', () => {
  it('should update value', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.updateMaxUses(10);

    expect(result.success).toBe(true);
    expect(token.maxUses).toBe(10);
  });

  it('should fail with <= 0', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.updateMaxUses(0);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.MAX_USES_INVALID);
    }
  });

  it('should fail with negative value', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.updateMaxUses(-1);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.MAX_USES_INVALID);
    }
  });

  it('should set unlimited with null', () => {
    const token = JoinToken.reconstitute(makeProps({ maxUses: 5 }));
    const result = token.updateMaxUses(null);

    expect(result.success).toBe(true);
    expect(token.maxUses).toBeNull();
  });
});

describe('JoinToken.incrementUseCount', () => {
  it('should increment use count', () => {
    const token = JoinToken.reconstitute(makeProps());
    const result = token.incrementUseCount();

    expect(result.success).toBe(true);
    expect(token.useCount).toBe(1);
  });

  it('should fail if exhausted', () => {
    const token = JoinToken.reconstitute(
      makeProps({ maxUses: 5, useCount: 5 })
    );
    const result = token.incrementUseCount();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.TOKEN_EXHAUSTED);
    }
  });

  it('should succeed when under limit', () => {
    const token = JoinToken.reconstitute(
      makeProps({ maxUses: 5, useCount: 4 })
    );
    const result = token.incrementUseCount();

    expect(result.success).toBe(true);
    expect(token.useCount).toBe(5);
  });
});

describe('JoinToken.canBeUsed', () => {
  it('should return false when expired', () => {
    const token = JoinToken.reconstitute(makeProps({ expiredAt: new Date() }));

    expect(token.canBeUsed()).toBe(false);
  });

  it('should return false when useCount >= maxUses', () => {
    const token = JoinToken.reconstitute(
      makeProps({ maxUses: 3, useCount: 3 })
    );

    expect(token.canBeUsed()).toBe(false);
  });

  it('should return true when active and under limit', () => {
    const token = JoinToken.reconstitute(
      makeProps({ maxUses: 10, useCount: 5 })
    );

    expect(token.canBeUsed()).toBe(true);
  });

  it('should return true when unlimited uses', () => {
    const token = JoinToken.reconstitute(
      makeProps({ maxUses: null, useCount: 100 })
    );

    expect(token.canBeUsed()).toBe(true);
  });
});

describe('JoinToken.toJSON', () => {
  it('should return all props', () => {
    const props = makeProps();
    const token = JoinToken.reconstitute(props);
    const json = token.toJSON();

    expect(json).toEqual(props);
  });
});

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('JoinToken profanity check', () => {
  it('should reject description with profanity', () => {
    const result = JoinToken.create(
      'org-1',
      'user-1',
      'badword invite',
      null,
      mockProfanityChecker
    );
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  });

  it('should pass clean description with profanityChecker', () => {
    const result = JoinToken.create(
      'org-1',
      'user-1',
      'Clean invite link',
      null,
      mockProfanityChecker
    );
    expect(result.success).toBe(true);
  });

  it('should pass without profanityChecker (backward compat)', () => {
    const result = JoinToken.create('org-1', 'user-1', 'Any description');
    expect(result.success).toBe(true);
  });
});
